# Admin sidebar — UI Coverage #752

The accepted section is `motion-react:page:/admin:section:sidebar-admin`, under
Dashboard admin #230. Its ten criteria were approved on 2026-10-06. The owner
authorized local implementation with “continua”; publication remains excluded.

Keep the existing eight admin destinations, order, icons, brand and profile link.
The dashboard matches only `/admin`; other destinations remain active on their
subroutes. The native branch continues to render the outlet without web navigation.

The web drawer receives a role-specific accessible title and description. Its logo
links gain a 44px click area without resizing the 36px brand mark. The scrolling
navigation must shrink inside the available height while the header and account
controls remain reachable. Opening explicitly focuses the logo because the default
Radix autofocus skips anchors. Radix retains focus trapping, Escape and trigger
focus restoration. Choosing a destination closes the drawer.

The close control stays last in DOM order and sits beside the role label using the
existing `top-20` spacing. Browser measurements put the logo at 16–60px and the first
destination at 125–169px; the close target at 80–124px avoids both hit areas.

Logout preserves the existing auth operation and successful destination. Pending
requests disable both copies of its control. A rejected promise or returned auth
error keeps the current route and displays a generic, retryable error beside the
control. The drawer remains open until a successful logout, so an error stays visible.

Verification covers the eight routes and subroute highlighting, accessible dialog
metadata, keyboard close/focus restoration, simulated pending/success/error logout,
COACH and CLUB navigation isolation, and the native outlet branch. Browser proof
uses 1440×900, 768×1024 and 375×812 in both themes, with role-specific audit accounts
and no business mutations. Unit tests and web emulation are not native device proof.

UI Coverage delta remains in this draft: #752 and shared portal consumers require
fingerprint recalculation after merge. No canonical inventory, human verdict or
publication gate is changed by this branch.
