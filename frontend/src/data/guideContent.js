import {
  LayoutDashboard, Users, FileText, CheckCircle,
  Send, BarChart3, Shield, Settings, Crown,
  UserPlus, AlertTriangle, Wallet, MessageSquare,
  Building2, ClipboardList, Search, Eye
} from 'lucide-react';

export const fieldOfficerGuide = {
  title: 'Field Officer Dashboard Guide',
  role: 'Field Officer',
  sections: [
    {
      icon: LayoutDashboard,
      title: 'Your Dashboard',
      items: [
        'Your dashboard shows your personal stats — total customers you have registered, loans you have submitted, and their current statuses.',
        'The "Incomplete Registrations" section shows customers whose registration is not yet complete.',
        'All data shown is filtered to your branch only — you cannot see other branches.',
      ]
    },
    {
      icon: UserPlus,
      title: 'Registering a New Customer',
      items: [
        'Click the "Register Customer" button at the top of your dashboard.',
        'Before the form opens you will see a checklist — make sure the customer has everything listed before proceeding.',
        'Fill in all steps: Personal Details → Residence → Income → Photos → Guarantors → Review.',
        'If the customer is missing documents like their National ID, click "Save as Draft" and select the reason. You can complete it later.',
        'Find your saved drafts in the "Incomplete Registrations" section on your dashboard.',
      ]
    },
    {
      icon: FileText,
      title: 'Submitting a Loan Application',
      items: [
        'After registering a customer, click "Apply for a Loan Now" on the success screen.',
        'Or find the customer in your customer list and click "Apply Loan" on their row.',
        'Select the loan product, enter the amount, select the reason, and submit.',
        'The loan will appear as UNVERIFIED in your loans list.',
      ]
    },
    {
      icon: CheckCircle,
      title: 'Verifying a Loan',
      items: [
        'Find the UNVERIFIED loan in your Loans list.',
        'Click "Verify Loan" — a checklist will appear.',
        'Go through each item carefully — physically confirm the photo matches the customer, the name matches the ID, and the phone number is correct.',
        'You must tick every box before submitting verification.',
        'Once verified, the loan moves to your Branch Manager for review.',
      ]
    },
    {
      icon: AlertTriangle,
      title: 'If a Loan is Rejected',
      items: [
        'If your Manager rejects a loan, it will appear as REJECTED in your list with a reason.',
        'Read the rejection reason carefully — fix the issue and contact your Manager if needed.',
      ]
    },
  ]
};

export const managerGuide = {
  title: 'Manager Dashboard Guide',
  role: 'Branch Manager',
  sections: [
    {
      icon: LayoutDashboard,
      title: 'Your Dashboard',
      items: [
        'Your dashboard shows your branch performance — active loans, overdue loans, and total portfolio value.',
        'You only see data from your assigned branch. Field Officers and customers from other branches are not visible to you.',
        'The "Loans Awaiting Review" section shows verified loans waiting for your approval.',
      ]
    },
    {
      icon: Users,
      title: 'Your Field Officers',
      items: [
        'Click "Field Officers" in the sidebar to see all officers in your branch.',
        'You can view each officer\'s registration and loan submission activity.',
        'If an officer needs to be flagged, use the deactivation request option on their row.',
      ]
    },
    {
      icon: CheckCircle,
      title: 'Approving a Loan',
      items: [
        'Go to the Loans tab and filter by VERIFIED status — these are loans waiting for your approval.',
        'Click on a loan to review the full customer profile, guarantors, income, and documents.',
        'When satisfied, click "Approve" — a checklist will appear that you must complete before confirming.',
        'Check that the loan amount is reasonable relative to the customer\'s income.',
        'Once approved, the loan moves to the Finance Officer for disbursement.',
      ]
    },
    {
      icon: AlertTriangle,
      title: 'Rejecting a Loan',
      items: [
        'Click "Reject" on any VERIFIED loan in your queue.',
        'You must provide a clear written reason — be specific so the Field Officer knows what to fix.',
        'The rejection is logged in the audit trail and the Field Officer is notified.',
      ]
    },
    {
      icon: MessageSquare,
      title: 'Communications',
      items: [
        'Use "Customer Comms" to send SMS messages to customers in your branch.',
        'Use "Official Comms" to send messages to your Field Officers.',
      ]
    },
  ]
};

export const financeOfficerGuide = {
  title: 'Finance Officer Dashboard Guide',
  role: 'Finance Officer',
  sections: [
    {
      icon: LayoutDashboard,
      title: 'Overview Page',
      items: [
        'Portfolio Size — total principal of all active and disbursed loans.',
        'Total Collections — all repayments received across the system.',
        'Available Capital — funds available for new disbursements.',
        'Portfolio at Risk — total value of overdue loans.',
        'Click the pipeline count cards to jump directly to relevant loan lists.',
      ]
    },
    {
      icon: Send,
      title: 'Disbursement Queue',
      items: [
        'This is your main working page — find it in the sidebar under "Disbursement Queue".',
        'All loans with APPROVED status appear here, sorted by approval date.',
        'Use the Branch filter at the top to work branch by branch.',
        'Click "Confirm & Disburse" on any row to disburse a single loan.',
        'Before disbursing, verify the M-Pesa phone number is correct — you can edit it in the confirmation modal if needed.',
        'Use "Bulk Disburse" only when you are confident all loans in the current filtered view are ready.',
        'Your role is DISBURSEMENT ONLY — you do not approve or reject loans.',
      ]
    },
    {
      icon: BarChart3,
      title: 'Analytics Page',
      items: [
        'Find it in the sidebar under "Analytics".',
        'Disbursement Rolling View — shows money going out over the last 15 days.',
        'Collection Rolling View — shows repayments coming in over the last 15 days.',
        'Weekly charts show volume trends over the last 10 weeks.',
        'Product Priority pie chart shows which loan products are most popular.',
      ]
    },
    {
      icon: ClipboardList,
      title: 'Ledger Page',
      items: [
        'Find it in the sidebar under "Ledger".',
        'Shows every repayment recorded in the system.',
        'Use the date range filter and branch filter to narrow down records.',
        'Each row shows the M-Pesa receipt number for reconciliation.',
      ]
    },
    {
      icon: FileText,
      title: 'Reports Page',
      items: [
        'Trial Balance — shows all accounts with debit and credit totals.',
        'Cashbook — full ledger of all money in and money out.',
        'Collection Log — all repayments in a journal format.',
        'Aging Report — shows overdue loans grouped by how long they have been overdue.',
      ]
    },
  ]
};

export const adminGuide = {
  title: 'Admin Dashboard Guide',
  role: 'Admin',
  sections: [
    {
      icon: LayoutDashboard,
      title: 'Overview Tab',
      items: [
        'The Overview tab is your landing page — it shows system-wide loan stats, portfolio health, and recent activity.',
        'Use the horizontal tabs at the top to navigate between Overview, Customers, Loans, Customer Comms and Official Comms.',
      ]
    },
    {
      icon: Users,
      title: 'Customers Tab',
      items: [
        'Search customers by name, phone, or National ID using the search bar.',
        'Click on any customer row to view their full profile, loan history, and guarantors.',
        'You can lock or unlock a customer account from their profile.',
      ]
    },
    {
      icon: FileText,
      title: 'Loans Tab',
      items: [
        'Filter loans by status using the status tabs — UNVERIFIED, VERIFIED, APPROVED, ACTIVE, OVERDUE, CLOSED, REJECTED.',
        'Click any loan row to view full details including repayment schedule.',
        'As Admin you can override a loan status with a written reason — use this carefully.',
      ]
    },
    {
      icon: Building2,
      title: 'Officials Sidebar Section',
      items: [
        'Click "Officials" in the sidebar to expand the dropdown.',
        'From here you can navigate to: Managers, Finance Officers, Field Officers, and Admins.',
        'Each page shows the staff list for that role with their branch, status, and activity.',
        'You can suspend staff or submit deactivation requests from their row.',
      ]
    },
    {
      icon: Settings,
      title: 'Settings Sidebar Section',
      items: [
        'Click "Settings" in the sidebar to expand options.',
        'Branches — create and manage branches.',
        'System — adjust grace periods, penalty rates, session timeout.',
        'Interest Settings — set interest rates per loan product.',
        'M-Pesa and SMS settings are managed by Super Admins.',
      ]
    },
    {
      icon: ClipboardList,
      title: 'Audit Logs',
      items: [
        'Find Audit Logs in the sidebar — this records every action taken in the system.',
        'Filter by log type: STATUS, COMMUNICATION, MANAGEMENT, SECURITY, GENERAL.',
        'Use this to investigate any issue or disputed action.',
      ]
    },
    {
      icon: MessageSquare,
      title: 'Communications',
      items: [
        'Customer Comms — send bulk SMS messages to customers filtered by branch, loan status, or individual.',
        'Official Comms — send email messages to staff members by role or individually.',
      ]
    },
  ]
};

export const ownerGuide = {
  title: 'Owner Dashboard Guide',
  role: 'System Owner',
  sections: [
    {
      icon: LayoutDashboard,
      title: 'Owner Dashboard',
      items: [
        'Your dashboard shows the top-level health of the entire business — portfolio size, collections, capital balance, and overdue risk.',
        'Staff Overview cards show counts for each role — click any card to navigate to that staff list.',
        'Recent Security Events and Owner Audit panels show the latest system activity.',
        'System Status shows your M-Pesa environment (sandbox vs production) and capital balance.',
      ]
    },
    {
      icon: Crown,
      title: 'Ownership Page',
      items: [
        'Find it in the sidebar under "Ownership".',
        'Shows all current owners — maximum 3 allowed.',
        'Grant Ownership — give ownership to an existing staff member or create a brand new owner account.',
        'Full Handover — transfer your ownership to someone else and remove yourself. Use this when selling the system.',
        'Relinquish — remove your own ownership. Only possible if at least one other owner exists.',
        'Every ownership action requires your password and sends email alerts to all owners.',
      ]
    },
    {
      icon: Eye,
      title: 'God Mode',
      items: [
        'Find the God Mode section at the bottom of your sidebar.',
        'Click any role view to switch into that dashboard — Admin, Manager, Finance Officer, or Field Officer.',
        'A gold banner at the top shows you are in God Mode and which role you are viewing.',
        'Click "Return to Owner Dashboard" in the banner to come back at any time.',
      ]
    },
    {
      icon: Shield,
      title: 'Security Logs',
      items: [
        'Find it in the sidebar under "Security Logs".',
        'Shows all security events — failed logins, IP mismatches, new device alerts, whitelist blocks.',
        'Security logs cannot be exported — this is intentional for compliance.',
        'All viewing of security logs is itself logged in the Owner Audit.',
      ]
    },
    {
      icon: ClipboardList,
      title: 'Owner Audit',
      items: [
        'Find it in the sidebar under "Owner Audit".',
        'Every significant action in the system is logged here — Super Admin actions, settings changes, ownership changes, financial overrides.',
        'The notification bell in the top right shows unread audit events.',
        'Use this to monitor what your Super Admins and Admins are doing.',
      ]
    },
    {
      icon: Settings,
      title: 'Settings',
      items: [
        'Access Settings from the sidebar dropdown.',
        'M-Pesa — enter your Daraja API keys, shortcode, and environment here. You and Super Admins can manage this.',
        'Security — enable IP whitelist, force 2FA for specific roles. Only you can access this tab.',
        'System — session timeout, login lockout threshold, disbursement limits.',
      ]
    },
    {
      icon: Send,
      title: 'Communicating with Super Admins',
      items: [
        'Go to "Communications" in your sidebar.',
        'Select "Super Admins" from the recipient group dropdown.',
        'You can also select "All Owners" to message all owner accounts.',
      ]
    },
  ]
};
