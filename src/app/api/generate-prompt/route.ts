import { NextRequest, NextResponse } from 'next/server';
import { generateDailyPrompt } from '@/lib/ai';
import { getServiceClient } from '@/lib/supabase';
import { differenceInYears, parseISO } from 'date-fns';

export async function POST(req: NextRequest) {
  try {
    const { parentId, parentName, childName, childDob } = await req.json();
    const childAge = differenceInYears(new Date(), parseISO(childDob));

    // Fetch recent topics to avoid repetition
    const db = getServiceClient();
    const { data: recentEntries } = await db
      .from('entries')
      .select('domain')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false })
      .limit(5);

    const recentTopics = recentEntries?.map((e: { domain: string }) => e.domain) ?? [];

    const prompt = await generateDailyPrompt({ parentName, childName, childAge, recentTopics });

    return NextResponse.json({ prompt });
  } catch (err) {
    console.error('[generate-prompt]', err);
    return NextResponse.json({ error: 'Failed to generate prompt' }, { status: 500 });
  }
}
