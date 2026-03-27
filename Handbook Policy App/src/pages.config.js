/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIHandbookGenerator from './pages/AIHandbookGenerator';
import AcknowledgementTracking from './pages/AcknowledgementTracking';
import ActivityLog from './pages/ActivityLog';
import ComplianceChecklist from './pages/ComplianceChecklist';
import Dashboard from './pages/Dashboard';
import EmployeeProfile from './pages/EmployeeProfile';
import GapAudit from './pages/GapAudit';
import Employees from './pages/Employees';
import HRRecords from './pages/HRRecords';
import Handbook from './pages/Handbook';
import Incidents from './pages/Incidents';
import MyOnboarding from './pages/MyOnboarding';
import MyWriteUps from './pages/MyWriteUps';
import Onboarding from './pages/Onboarding';
import OrgSettings from './pages/OrgSettings';
import Policies from './pages/Policies';
import PolicyEditor from './pages/PolicyEditor';
import PolicyView from './pages/PolicyView';
import Profile from './pages/Profile';
import ReAcknowledgmentManagement from './pages/ReAcknowledgmentManagement';
import Setup from './pages/Setup';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIHandbookGenerator": AIHandbookGenerator,
    "AcknowledgementTracking": AcknowledgementTracking,
    "ActivityLog": ActivityLog,
    "ComplianceChecklist": ComplianceChecklist,
    "Dashboard": Dashboard,
    "EmployeeProfile": EmployeeProfile,
    "GapAudit": GapAudit,
    "Employees": Employees,
    "HRRecords": HRRecords,
    "Handbook": Handbook,
    "Incidents": Incidents,
    "MyOnboarding": MyOnboarding,
    "MyWriteUps": MyWriteUps,
    "Onboarding": Onboarding,
    "OrgSettings": OrgSettings,
    "Policies": Policies,
    "PolicyEditor": PolicyEditor,
    "PolicyView": PolicyView,
    "Profile": Profile,
    "ReAcknowledgmentManagement": ReAcknowledgmentManagement,
    "Setup": Setup,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};