/* Public browser configuration. This file must NEVER contain secret keys. */
window.MAGIC_ACCESS_CONFIG = Object.freeze({
  projectUrl: 'https://efvwlunhpmazfgwyqsiv.supabase.co',
  publishableKey: '', // Copy sb_publishable_... from Supabase → Project Settings → API Keys
  // Paid calendar must live behind a server access check.
  // Do NOT put public index.html here; it is not protected.
  protectedCalendarUrl: ''
});
