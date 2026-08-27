# My-Kids-Hub Profile System Update Audit

## Update Request
Implement the Header Profile / Avatar System using the existing application as Source of Truth, with minimum profile-related changes only.

## Source
Uploaded existing project: My-Kids-Hub-main(1).zip

## Existing structure reviewed
- 13 HTML pages
- Shared app shell: assets/js/app-shell.js and assets/css/app-shell.css
- Existing canonical profile table: public.profiles
- Existing avatar_url field
- Existing Supabase Auth / session flow
- Existing Settings page and navigation
- Existing sidebar/header/theme/language/notification functionality

## Changes
- Dynamic profile name, role and avatar loading from public.profiles / authenticated user metadata.
- Photo avatar with initials fallback and broken-image fallback.
- Profile chip keyboard accessibility and aria-expanded state.
- Animated profile dropdown with user summary and requested links.
- Outside click, trigger toggle and Escape close.
- Logout confirmation, Supabase signOut, client storage cleanup and login redirect.
- Password change with current-password verification and 8-character/upper/lower/number/special/match validation.
- Profile editing for name, phone, address; registered email, user ID and role are read-only.
- Avatar upload validation and Supabase Storage integration.
- Account notification preferences, theme, language/date/time preferences.
- Supabase MFA TOTP enable/verify/disable flow.
- Logout-other-sessions using Supabase Auth scope=others.
- Protected-page session checks on bfcache/popstate and no-cache meta tags.
- Additive SQL migration for profile address/preferences and avatars storage bucket/policies.

## Verification
- JavaScript syntax: PASS (15 files checked)
- HTML parsing: PASS (13 pages checked)
- Protected pages contain shared app shell/profile trigger/cache metadata: PASS (9/9)
- Existing source files were not deleted.
- Live authenticated Supabase CRUD, Storage, MFA, email delivery, and browser rendering were not executable in this environment and are not claimed as runtime-tested.
