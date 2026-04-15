import { NextRequest, NextResponse } from 'next/server';
import { tagEntry, generateFollowUp } from '@/lib/ai';
import { getServiceClient } from '@/lib/supabase';
import { differenceInYears, parseISO } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { parentId, childName, childDob, content } = await req.json();

    const childAge = differenceInYears(new Date(), parseISO(childDob));

    // AI tags the entry — fully invisible to the parent
    const [tags, followUp] = await Promise.all([
      tagEntry(content, childAge),
      generateFollowUp(content),
    ]);

    const db = getServiceClient();

    const { data, error } = await db
      .from('entries')
      .insert({
        parent_id:     parentId,
        child_name:    childName,
        content,
        follow_up:     followUp,
        domain:        tags.domain,
        relevant_age:  tags.relevantAge,
        delivery_type: tags.deliveryType,
        summary:       tags.summary,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ entry: data, followUp });
  } catch (err) {
    console.error('[save-entry]', err);
    return NextResponse.json({ error: 'Failed to save entry' }, { status: 500 });
  }
}

// Append follow-up addition to an existing entry
export async function PATCH(req: NextRequest) {
  try {
    const { entryId, appendContent } = await req.json();

    const db = getServiceClient();

    const { data: existing, error: fetchError } = await db
      .from('entries')
      .select('content')
      .eq('id', entryId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await db
      .from('entries')
      .update({ content: `${existing.content}\n\n${appendContent}` })
      .eq('id', entryId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[save-entry PATCH]', err);
    return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
  }
}
