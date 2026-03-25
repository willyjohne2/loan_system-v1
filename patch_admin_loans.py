import re

with open("frontend/src/dashboards/AdminLoans.jsx", "r") as f:
    content = f.read()

# 1. Update filter logic
old_filter = """      // Filter by Tab
      const isDisbursed = ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(loan.status);
      const isPending = ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(loan.status);
      const isRejected = loan.status === 'REJECTED';

      if (activeTab === 'ACTIVE' && !isDisbursed) return false;
      if (activeTab === 'PENDING' && !isPending) return false;
      if (activeTab === 'REJECTED' && !isRejected) return false;"""

new_filter = """      // Filter by Tab
      if (activeTab === 'ALL_DISBURSED' && !['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(loan.status)) return false;
      if (activeTab === 'ACTIVE' && loan.status !== 'ACTIVE') return false;
      if (activeTab === 'OVERDUE' && loan.status !== 'OVERDUE') return false;
      if (activeTab === 'APPROVED' && loan.status !== 'APPROVED') return false;
      if (activeTab === 'PENDING' && !['UNVERIFIED', 'VERIFIED', 'PENDING'].includes(loan.status)) return false;
      if (activeTab === 'REJECTED' && loan.status !== 'REJECTED') return false;"""

content = content.replace(old_filter, new_filter)

# 2. Update initial state
content = content.replace("useState('ACTIVE');", "useState('ALL_DISBURSED');")

# 3. Update tabs UI
old_tabs = """        {[
          { id: 'ACTIVE', label: 'Disbursed Portfolio', icon: CheckCircle },
          { id: 'PENDING', label: 'Approval Queue', icon: Clock },
          { id: 'REJECTED', label: 'Rejected', icon: XCircle }
        ].map(tab => (
          <button"""

new_tabs_ui = """        {[
          { id: 'ALL_DISBURSED', label: 'All Disbursed', icon: Building2 },
          { id: 'ACTIVE', label: 'Active Loans', icon: CheckCircle },
          { id: 'OVERDUE', label: 'Overdue Loans', icon: Clock },
          { id: 'APPROVED', label: 'Approved', icon: FileCheck },
          { id: 'PENDING', label: 'Pending Review', icon: Search },
          { id: 'REJECTED', label: 'Rejected', icon: XCircle }
        ].map(tab => (
          <button"""

content = content.replace(old_tabs, new_tabs_ui)

# 4. Update tabs count logic
old_count = """              {loans.filter(l => {
                const s = l.status;
                if (tab.id === 'ACTIVE') return ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(s);
                if (tab.id === 'PENDING') return ['UNVERIFIED', 'VERIFIED', 'APPROVED', 'PENDING'].includes(s);
                return s === 'REJECTED';
              }).length}"""

new_count = """              {loans.filter(l => {
                const s = l.status;
                if (tab.id === 'ALL_DISBURSED') return ['DISBURSED', 'ACTIVE', 'OVERDUE', 'CLOSED', 'REPAID'].includes(s);
                if (tab.id === 'ACTIVE') return s === 'ACTIVE';
                if (tab.id === 'OVERDUE') return s === 'OVERDUE';
                if (tab.id === 'APPROVED') return s === 'APPROVED';
                if (tab.id === 'PENDING') return ['UNVERIFIED', 'VERIFIED', 'PENDING'].includes(s);
                if (tab.id === 'REJECTED') return s === 'REJECTED';
                return false;
              }).length}"""


content = content.replace(old_count, new_count)

with open("frontend/src/dashboards/AdminLoans.jsx", "w") as f:
    f.write(content)
