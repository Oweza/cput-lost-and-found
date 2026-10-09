<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Data access uses the browser Supabase client with RLS (no server functions) — all rules live in policies.
- Item photos live in a private bucket; store the object path and render via signed URLs — public buckets are blocked by workspace policy.
- Match notifications and claim outcomes are produced by database triggers — keeps notifications consistent regardless of client.
- Admin access is the `admin` row in `user_roles`, checked via `has_role` — never from profile data.
