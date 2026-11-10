# 02 · Using Pocket Ledger

[← Documentation index](README.md)

This guide explains what is currently visible in the app. It describes a prototype: it does not connect to banks, mobile-money providers, or a cloud account, and it does not automatically import real transactions.

> **Before entering important data:** the app starts with sample records; backup restore has a known validation issue; mixed-currency totals and transfers have unresolved problems. Keep an independent copy of important records. See [Known issues](08-known-issues-and-roadmap.md).

## Navigation

- **Home**: available balance in the reporting currency, current-month income, spending and net, accounts, budgets, upcoming items, recent activity and goals.
- **Activity**: find and manage individual transactions.
- **Budgets**: set and review category caps.
- **Goals**: create a savings target and view its progress and contributions.
- **Insights**: view charts based on stored transactions, budgets and goals.
- **Accounts** and **Settings**: available from the sidebar on tablet/desktop and from actions on Home.

Phones use a bottom navigation bar. At 768 CSS pixels and wider, the app displays a persistent sidebar. The floating **+** opens the transaction form on supported screens.

## Accounts

1. Open **Accounts** from Home or the sidebar.
2. Choose **New**.
3. Enter a name, type, currency and opening balance; optionally add notes.
4. Save the account. Tap an account to see its calculated balance and activity.

Supported types are cash, mobile money, bank, savings and other. The displayed balance is derived from the opening balance and linked transactions; it is not a live bank balance. Existing account edit/delete controls are present in the code but are not currently reachable from the account-detail screen.

## Record income or an expense

1. Tap **+**, **Add expense**, or **Add income**.
2. Choose **Expense** or **Income**.
3. Enter the amount with the keypad or the amount field.
4. Enter a description, select an account and category, then choose a date. Notes are optional.
5. Save. The app validates the form and writes the record to this browser's IndexedDB.

The chosen account determines the transaction currency. When it differs from the reporting currency, the current form requires a positive manually entered exchange rate and displays a converted amount for that report currency. The original amount and currency remain on the transaction.

Extra decimal digits are truncated by the current parser rather than rejected. Review the displayed amount and the currency before saving. The current UI offers the seeded categories but does not expose a screen for creating custom categories.

## Find, edit or delete a transaction

In **Activity**, select a month with the arrows. Search descriptions or notes, or open **Filters** for type, category, account, date range and sort order. The date filters are applied inside the selected month, not across the whole history.

Tap a row to open the edit sheet. Make changes and save, or use the delete control in the sheet and confirm. Account balances and applicable reports are recalculated from the remaining records.

## Transfers

Choose **Transfer** in the transaction form or from **Accounts**. Select a source and destination account. The monthly income and spending functions exclude transfers.

**Current safety limitation:** the form does not prevent selecting accounts in different currencies, and the balance calculation applies the same integer amount to both sides without an exchange rate. Use transfers only between accounts in the **same currency** until this is fixed; check the resulting balances manually.

## Budgets

1. Open **Budgets** and select the month you want to view.
2. Choose **New**, select an expense category and enter a monthly amount.
3. Review spent, allocated, remaining and the progress bar. Tap a budget row to change or remove the cap.

A budget is stored as a recurring category cap starting in a month. Editing it updates the existing record; it does not preserve a separate amount for each historical month. The calculation labels 60% as watch, 85% as near and 100% or more as over. Mixed-currency budget totals need further work; use one reporting currency for budgets and verify totals independently.

## Savings goals

Choose **New** on **Goals**, give the goal a name and target, optionally add a date and description, and choose an icon and color. Open the goal to see progress and its history. Use **Add money** or **Withdraw** to record a contribution; selecting an account also records an associated income or expense transaction.

The current implementation does not block a withdrawal larger than the goal's saved total. Goal edit/delete code exists but is not wired to a visible edit action. The combined goals total also needs a mixed-currency safeguard. Keep goals in one currency and review amounts manually until these are addressed.

## Insights

Insights uses stored records to show a six-month income/spending trend, category breakdown, budget performance and goal progress. For the headline “Saved,” the code calculates **(income − expenses) ÷ income** for the current month; it is not a sum of goal contributions. Transfers are excluded from the monthly income/expense calculation.

The charts depend on the reporting currency and the available conversions. Some mixed-currency summaries remain unsafe; see [Data model and finance](04-data-model-and-finance.md).

## Appearance and privacy

The eye control on Home toggles the privacy setting. It masks values rendered by the shared `Money` component, but **not every amount**: some summaries and charts format values directly. It is a display convenience, not encryption or access control; do not assume a screenshot is fully redacted.

**Settings → Appearance** provides light, dark and system themes. You can change the reporting currency and enable supported currencies. The general exchange-rate fields in Settings are not currently connected to persisted state; enter a rate on each foreign-currency transaction instead.

## Backup and sample-data controls

**Settings → Export JSON backup** downloads a JSON snapshot. **Restore from backup** is present, but a current validation mismatch can reject the app's own export. Keep the original browser data and the JSON file until restore has been fixed and verified. Google Drive is shown as **Not connected** and cannot be enabled in this version.

**Settings → Reset sample data** and **Delete all data** are destructive operations. Demo reset currently deletes category IDs by prefix, including custom categories created programmatically, and may leave user records pointing at removed sample accounts. Avoid these controls after entering real data until the known issues are resolved.
