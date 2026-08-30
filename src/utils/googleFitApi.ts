export interface GoogleFitSleepSession {
  id: string;
  name: string;
  startTimeMillis: number;
  endTimeMillis: number;
  durationMinutes: number;
  sleepDurationStr: string; // e.g. "7ч 45м"
  sleepQualityPercent: number;
  dayOfMonth: number;
  dateStr: string;
  sourceApp: string;
}

export interface GoogleFitConfig {
  clientId: string;
  accessToken: string;
  tokenExpiresAt: number;
  isConnected: boolean;
  userEmail?: string;
  lastSyncTime?: string;
}

const STORAGE_KEY = 'questflow_google_fit_config_v1';

export function loadGoogleFitConfig(): GoogleFitConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch (e) {
    console.error(e);
  }
  return {
    clientId: '782910481920-questflow-demo.apps.googleusercontent.com',
    accessToken: '',
    tokenExpiresAt: 0,
    isConnected: false,
    userEmail: '',
    lastSyncTime: '',
  };
}

export function saveGoogleFitConfig(config: GoogleFitConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error(e);
  }
}

/**
 * Fetch real sleep sessions from Google Fitness REST API
 */
export async function fetchGoogleFitSleepData(
  accessToken: string,
  year: number = 2026,
  month: number = 8 // 1-12 (August)
): Promise<{ sessions: GoogleFitSleepSession[]; rawData?: any; error?: string }> {
  if (!accessToken) {
    return { sessions: [], error: 'Access token отсутствует. Авторизуйтесь через Google OAuth.' };
  }

  // Calculate month start & end in millis
  const startDate = new Date(year, month - 1, 1, 0, 0, 0);
  const endDate = new Date(year, month, 0, 23, 59, 59);
  const startTimeMillis = startDate.getTime();
  const endTimeMillis = endDate.getTime();

  try {
    // 1. Query Google Fit Sessions API for activityType 72 (Sleep)
    const sessionsUrl = `https://www.googleapis.com/fitness/v1/users/me/sessions?startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}&activityType=72`;
    
    const sessionsRes = await fetch(sessionsUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sessionsRes.ok) {
      const errText = await sessionsRes.text();
      return { 
        sessions: [], 
        error: `Google Fit API Error (${sessionsRes.status}): ${errText}` 
      };
    }

    const sessionsData = await sessionsRes.json();
    const rawSessions = sessionsData.session || [];

    // 2. Query aggregate sleep segment dataset for deep/light sleep breakdown
    const aggregateUrl = `https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`;
    const aggregateRes = await fetch(aggregateUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        aggregateBy: [
          { dataTypeName: 'com.google.sleep.segment' }
        ],
        startTimeMillis,
        endTimeMillis,
        bucketByTime: { durationMillis: 86400000 }, // 1 day buckets
      }),
    });

    let aggregateBuckets: any[] = [];
    if (aggregateRes.ok) {
      const aggJson = await aggregateRes.json();
      aggregateBuckets = aggJson.bucket || [];
    }

    const parsedSessions: GoogleFitSleepSession[] = [];

    // Map sessions
    for (const s of rawSessions) {
      const sStart = parseInt(s.startTimeMillis, 10);
      const sEnd = parseInt(s.endTimeMillis, 10);
      const durationMs = sEnd - sStart;
      const durationMins = Math.max(0, Math.round(durationMs / (1000 * 60)));
      
      const sessionDate = new Date(sEnd); // wake up day
      const dayOfMonth = sessionDate.getDate();
      const dateStr = sessionDate.toISOString().split('T')[0];

      const hours = Math.floor(durationMins / 60);
      const mins = durationMins % 60;
      const sleepDurationStr = `${hours}ч ${mins < 10 ? '0' : ''}${mins}м`;

      // Estimate or calculate quality %
      let quality = 85;
      if (durationMins >= 450) quality = 90;
      else if (durationMins >= 420) quality = 85;
      else if (durationMins >= 360) quality = 75;
      else quality = 60;

      parsedSessions.push({
        id: s.id || `gfit-${sStart}`,
        name: s.name || 'Sleep Cycle Session',
        startTimeMillis: sStart,
        endTimeMillis: sEnd,
        durationMinutes: durationMins,
        sleepDurationStr,
        sleepQualityPercent: quality,
        dayOfMonth,
        dateStr,
        sourceApp: s.application?.name || 'Sleep Cycle',
      });
    }

    return { sessions: parsedSessions, rawData: sessionsData };
  } catch (err: any) {
    return {
      sessions: [],
      error: `Сетевая ошибка при запросе к Google Fit: ${err.message || String(err)}`,
    };
  }
}

/**
 * Initialize Google OAuth 2.0 Token Client for browser
 */
export function initGoogleFitTokenAuth(
  clientId: string,
  onSuccess: (token: string, expiresIn: number) => void,
  onError: (error: any) => void
) {
  // Check if GIS script loaded
  if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/fitness.sleep.read https://www.googleapis.com/auth/fitness.activity.read email profile',
        callback: (tokenResponse: any) => {
          if (tokenResponse.error) {
            onError(tokenResponse);
          } else {
            onSuccess(tokenResponse.access_token, tokenResponse.expires_in || 3600);
          }
        },
      });
      client.requestAccessToken();
    } catch (e) {
      onError(e);
    }
  } else {
    onError(new Error('Google Identity Services script еще загружается...'));
  }
}
