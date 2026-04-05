import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/api/client';
import { createPageUrl } from '../utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, Check, X, ExternalLink, Copy, Loader2, FlaskConical, ChevronDown, ChevronUp, LogOut, Trash2, Archive } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function SuperAdmin() {
  const { user, superAdmin, logout } = useAuth();
  const [approvedOrgs, setApprovedOrgs] = useState([]);
  const [pendingOrgs, setPendingOrgs] = useState([]);
  const [allOrgs, setAllOrgs] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [launchingOrgId, setLaunchingOrgId] = useState(null);
  const [newLocName, setNewLocName] = useState('');
  const [newLocAddress, setNewLocAddress] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [locationToDelete, setLocationToDelete] = useState(null);
  const [orgToReject, setOrgToReject] = useState(null);
  const [orgToArchive, setOrgToArchive] = useState(null);
  const [hideTestOrgs, setHideTestOrgs] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const isTestOrg = (org) =>
    org?.name?.startsWith('Test Org ') ||
    org?.name?.startsWith('test-') ||
    org?.name === '_TEST_Location_SuperAdmin';
  const displayedOrgs = hideTestOrgs ? approvedOrgs.filter((o) => !isTestOrg(o)) : approvedOrgs;

  useEffect(() => {
    if (!superAdmin) {
      window.location.href = createPageUrl('Login');
      return;
    }
    loadData();
  }, [superAdmin]);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const [orgsWithLocs, pending, all, locs] = await Promise.all([
        api.superAdmin.orgsWithLocations(),
        api.superAdmin.pendingOrgs(),
        api.superAdmin.allOrgs(),
        api.superAdmin.platformLocations(),
      ]);
      setApprovedOrgs(orgsWithLocs || []);
      setPendingOrgs(pending || []);
      setAllOrgs(all || []);
      setLocations(locs || []);
    } catch (e) {
      console.error(e);
      setLoadError(e.data?.error || e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function approveOrg(orgId) {
    setActionLoading(orgId);
    try {
      await api.superAdmin.approveOrg(orgId);
      loadData();
    } catch (e) {
      alert(e.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmRejectOrg() {
    if (!orgToReject) return;
    setActionLoading(orgToReject.id);
    try {
      await api.superAdmin.rejectOrg(orgToReject.id);
      setOrgToReject(null);
      loadData();
    } catch (e) {
      alert(e.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmArchiveOrg() {
    if (!orgToArchive) return;
    setActionLoading(`archive-${orgToArchive.id}`);
    try {
      await api.superAdmin.archiveOrg(orgToArchive.id);
      setOrgToArchive(null);
      loadData();
    } catch (e) {
      alert(e.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function launchOrg(orgId) {
    setLaunchingOrgId(orgId);
    try {
      const { data } = await api.superAdmin.launchToken(orgId);
      if (data?.launch_link) {
        window.open(data.launch_link, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      alert(e.data?.error || e.message);
    } finally {
      setLaunchingOrgId(null);
    }
  }

  async function copyAccessLink(orgId) {
    try {
      const { data } = await api.superAdmin.launchToken(orgId);
      if (data?.launch_link) {
        await navigator.clipboard.writeText(data.launch_link);
        alert('Access link copied to clipboard');
      }
    } catch (e) {
      alert(e.data?.error || e.message);
    }
  }

  async function launchTest() {
    setLaunchingOrgId('_TEST_');
    try {
      const testData = await api.superAdmin.ensureTestOrg();
      const orgId = testData?.organization_id;
      if (!orgId) throw new Error('Could not create test org');
      const { data: launchData } = await api.superAdmin.launchToken(orgId);
      if (launchData?.launch_link) {
        window.open(launchData.launch_link, '_blank', 'noopener,noreferrer');
      }
    } catch (e) {
      alert(e.data?.error || e.message);
    } finally {
      setLaunchingOrgId(null);
    }
  }

  async function createLocation() {
    if (!newLocName.trim()) return;
    setActionLoading('create-loc');
    try {
      await api.superAdmin.createLocation(newLocName.trim(), newLocAddress.trim());
      setNewLocName('');
      setNewLocAddress('');
      loadData();
    } catch (e) {
      alert(e.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function confirmDeleteLocation() {
    if (!locationToDelete) return;
    setActionLoading(`delete-${locationToDelete.id}`);
    try {
      await api.superAdmin.deletePlatformLocation(locationToDelete.id);
      setLocationToDelete(null);
      loadData();
    } catch (e) {
      alert(e.data?.error || e.message);
    } finally {
      setActionLoading(null);
    }
  }

  if (!superAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">Super Admin</h1>
              <p className="text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.location.href = createPageUrl('Profile')}>
              My Account
            </Button>
            <Button variant="outline" size="sm" onClick={() => { logout(); window.location.href = createPageUrl('Login'); }}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-noble animate-spin" />
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800 font-medium">Failed to load data</p>
            <p className="text-sm text-red-600 mt-1">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={loadData}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* Pending approvals */}
            {pendingOrgs.length > 0 && (
              <Card className="border-amber-200 bg-amber-50/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Pending Approvals
                    <span className="text-sm font-normal text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                      {pendingOrgs.length} waiting
                    </span>
                  </CardTitle>
                  <p className="text-sm text-slate-600">Organizations awaiting your approval</p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {pendingOrgs.map((org) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-4 rounded-lg border border-amber-200 bg-white"
                      >
                        <div>
                          <h3 className="font-medium text-slate-900">{org.name}</h3>
                          <p className="text-sm text-slate-500">{org.industry || '—'}</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Admin: {org.admin_email} ({org.admin_name || '—'})
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approveOrg(org.id)}
                            disabled={actionLoading === org.id}
                          >
                            {actionLoading === org.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setOrgToReject(org)}
                            disabled={actionLoading === org.id}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Launch Test Instance */}
            <Card className="border-violet-200 bg-violet-50/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-violet-600" />
                  Launch Test Instance
                </CardTitle>
                <p className="text-sm text-slate-600">Launch a test instance of the app to verify setup or troubleshoot issues</p>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={launchTest}
                  disabled={launchingOrgId === '_TEST_'}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {launchingOrgId === '_TEST_' ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Launch Test App
                </Button>
              </CardContent>
            </Card>

            {/* Approved Organizations */}
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="w-5 h-5" />
                      Approved Organizations
                    </CardTitle>
                    <p className="text-sm text-slate-500 mt-1">
                      Organizations that have completed signup and been approved. {displayedOrgs.length} shown.
                    </p>
                  </div>
                  {approvedOrgs.some(isTestOrg) && (
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hideTestOrgs}
                        onChange={(e) => setHideTestOrgs(e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Hide test orgs
                    </label>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {displayedOrgs.length === 0 ? (
                  <p className="text-sm text-slate-500 py-8 text-center">
                    {approvedOrgs.length === 0 ? 'No approved organizations yet' : 'No organizations match the current filter'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {displayedOrgs.map((org) => (
                      <div
                        key={org.id}
                        className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="font-semibold text-slate-900">{org.name}</h3>
                            <div className="mt-2 space-y-1 text-sm text-slate-600">
                              <p>
                                <span className="font-medium text-slate-500">Admin:</span>{' '}
                                {org.admin_name || '—'} ({org.admin_email || '—'})
                              </p>
                              {org.locations?.length > 0 && (
                                <div className="mt-2">
                                  <span className="font-medium text-slate-500">Locations:</span>
                                  <ul className="mt-1 space-y-1">
                                    {org.locations.map((loc) => (
                                      <li key={loc.id} className="flex items-start gap-2">
                                        <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                        <span>
                                          {loc.name}
                                          {loc.address && <span className="text-slate-500"> — {loc.address}</span>}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyAccessLink(org.id)}
                              className="gap-1"
                            >
                              <Copy className="w-4 h-4" />
                              Copy Link
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => launchOrg(org.id)}
                              disabled={launchingOrgId === org.id}
                              className="gap-1 bg-noble hover:bg-noble-dark"
                            >
                              {launchingOrgId === org.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ExternalLink className="w-4 h-4" />
                              )}
                              Launch
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="opacity-70 hover:opacity-100 hover:bg-amber-50 hover:text-amber-700 gap-1"
                              onClick={() => setOrgToArchive(org)}
                              disabled={!!actionLoading}
                            >
                              <Archive className="w-4 h-4" />
                              Archive
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Collapsible: Platform locations & All orgs */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowMore(!showMore)}
                className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                More options
                {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showMore && (
                <div className="border-t border-slate-200 p-4 space-y-6 bg-slate-50/30">
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">Platform Locations</h4>
                    <div className="flex gap-2 mb-3">
                      <Input
                        placeholder="Location name"
                        value={newLocName}
                        onChange={(e) => setNewLocName(e.target.value)}
                        className="max-w-xs"
                      />
                      <Input
                        placeholder="Address (optional)"
                        value={newLocAddress}
                        onChange={(e) => setNewLocAddress(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button onClick={createLocation} disabled={!newLocName.trim() || actionLoading === 'create-loc'} size="sm">
                        {actionLoading === 'create-loc' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Add'}
                      </Button>
                    </div>
                    {locations.length === 0 ? (
                      <p className="text-sm text-slate-500">No platform locations yet</p>
                    ) : (
                      <ul className="space-y-1">
                        {locations.map((loc) => (
                          <li key={loc.id} className="flex items-center justify-between gap-2 py-1.5 text-sm group">
                            <span className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              {loc.name}
                              {loc.address && <span className="text-slate-500 truncate">— {loc.address}</span>}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="opacity-70 hover:opacity-100 hover:bg-red-50 hover:text-red-600 flex-shrink-0"
                              onClick={() => setLocationToDelete(loc)}
                              disabled={!!actionLoading}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">All Organizations ({allOrgs.length})</h4>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {allOrgs.map((org) => (
                        <div key={org.id} className="flex items-center justify-between py-1.5 text-sm border-b border-slate-100 last:border-0">
                          <span className="font-medium truncate">{org.name}</span>
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded flex-shrink-0 ${
                            org.status === 'active' ? 'bg-green-100 text-green-700' :
                            org.status === 'pending_approval' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {org.status?.replace('_', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <AlertDialog open={!!locationToDelete} onOpenChange={(open) => !open && setLocationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete location?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{locationToDelete?.name}</strong>? This will soft-delete the
              location—it will be hidden from the list but data is preserved. Organizations that already use this
              location will keep their existing data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading?.startsWith('delete-')}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading?.startsWith('delete-')}
              onClick={() => confirmDeleteLocation()}
            >
              {actionLoading?.startsWith('delete-') ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {actionLoading?.startsWith('delete-') ? 'Deleting…' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!orgToReject} onOpenChange={(open) => !open && setOrgToReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject <strong>{orgToReject?.name}</strong>? The admin will need to request
              approval again to regain access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!actionLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-red-600 hover:bg-red-700"
              disabled={!!actionLoading}
              onClick={() => confirmRejectOrg()}
            >
              {actionLoading === orgToReject?.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Reject
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!orgToArchive} onOpenChange={(open) => !open && setOrgToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive <strong>{orgToArchive?.name}</strong>? This will soft-delete the
              organization—it will be hidden from the approved list but data is preserved. You can restore it later
              if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading?.startsWith('archive-')}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              className="bg-amber-600 hover:bg-amber-700"
              disabled={actionLoading?.startsWith('archive-')}
              onClick={() => confirmArchiveOrg()}
            >
              {actionLoading?.startsWith('archive-') ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {actionLoading?.startsWith('archive-') ? 'Archiving…' : 'Archive'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

