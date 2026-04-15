import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const parentId = searchParams.get('parentId');

    if (!parentId) {
      return NextResponse.json({ error: 'parentId required' }, { status: 400 });
    }

    const db = getServiceClient();
    const { data, error } = await db
      .from('entries')
      .select('id, summary, domain, relevant_age, delivery_type, created_at, delivered_at')
      .eq('parent_id', parentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ entries: data });
  } catch (err) {
    console.error('[entries]', err);
    return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
  }
}
