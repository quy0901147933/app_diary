import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/services/supabase';

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_PATH = 'auth-callback';

export async function signInWithGoogle() {
  const redirectTo = Linking.createURL(REDIRECT_PATH);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  if (!data?.url) throw new Error('Không lấy được URL đăng nhập từ Supabase.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error('cancelled');
  }

  const { params, errorCode } = parseAuthUrl(result.url);
  if (errorCode) throw new Error(errorCode);

  if (params.access_token && params.refresh_token) {
    const { error: setErr } = await supabase.auth.setSession({
      access_token: params.access_token,
      refresh_token: params.refresh_token,
    });
    if (setErr) throw setErr;
    return;
  }

  if (params.code) {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(params.code);
    if (exErr) throw exErr;
    return;
  }

  throw new Error('Phản hồi OAuth không có token.');
}

function parseAuthUrl(url: string) {
  const parsed = Linking.parse(url);
  const fragment = url.includes('#') ? url.split('#')[1] : '';
  const fragParams = Object.fromEntries(new URLSearchParams(fragment));
  const params: Record<string, string> = {
    ...(parsed.queryParams as Record<string, string> | null ?? {}),
    ...fragParams,
  };
  return { params, errorCode: params.error ?? params.error_code };
}
