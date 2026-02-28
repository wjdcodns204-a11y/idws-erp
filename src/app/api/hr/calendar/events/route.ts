import { NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { google } from 'googleapis';

export async function GET() {
    try {
        const supabase = await createSupabaseServer();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch tokens for the current employee (or all? Let's do current user for their personal overlay)
        // Re-check plan: The Google Calendar is usually personal, combined with company tasks/leaves.
        // We'll fetch the logged-in user's Google events.
        const { data: emp } = await supabase
            .from('employees')
            .select('google_access_token, google_refresh_token, google_token_expiry')
            .eq('email', user.email)
            .single();

        if (!emp || !emp.google_refresh_token) {
            return NextResponse.json({ events: [], message: 'No Google Calendar connected' }, { status: 200 });
        }

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/google/callback`
        );

        oauth2Client.setCredentials({
            access_token: emp.google_access_token,
            refresh_token: emp.google_refresh_token,
            expiry_date: emp.google_token_expiry ? new Date(emp.google_token_expiry).getTime() : null,
        });

        const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

        // Fetch events from one month ago to one month ahead
        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 1);

        const timeMax = new Date();
        timeMax.setMonth(timeMax.getMonth() + 2);

        const res = await calendar.events.list({
            calendarId: 'primary',
            timeMin: timeMin.toISOString(),
            timeMax: timeMax.toISOString(),
            maxResults: 100,
            singleEvents: true,
            orderBy: 'startTime',
        });

        return NextResponse.json({ events: res.data.items }, { status: 200 });

    } catch (error: unknown) {
        console.error('Google Calendar fetch error:', error);
        return NextResponse.json({ events: [], error: 'Failed to fetch Google Calendar events' }, { status: 500 });
    }
}
