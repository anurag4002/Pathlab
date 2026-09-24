import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getTests, getCategories } from '../../services/testService';
import { getPanels } from '../../services/panelService';
import { getPackages } from '../../services/packageService';
import formatCurrency from '../../utils/formatCurrency';
import useDebounce from '../../hooks/useDebounce';
import { PageHeader, Button, DataTable, Select, StatusBadge } from '../../components/common';
import '../../styles/RateList.css';

/* Option lists mirror existing backend enums — no business data lives here.
   status: Active | Inactive on the Test, TestPanel and TestPackage models.
   Type values are the three sources this view consolidates (nothing else). */
const STATUS_OPTIONS = [
  { value: 'Active', label: 'Active' },
  { value: 'Inactive', label: 'Inactive' }
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'Test', label: 'Tests' },
  { value: 'Panel', label: 'Panels' },
  { value: 'Package', label: 'Packages' }
];

/* Client-side page size — the rate endpoints expose no page/limit parameters,
   so the unified list paginates the API's full response locally using the
   standard DataTable pagination metadata shape. */
const PAGE_SIZE = 15;

/* Surfaces only the backend's user-facing `message` field (never stack traces),
   with sensible fallbacks per failure type (same mapping as the other lab
   screens). */
const getApiErrorMessage = (err, fallback) => {
  if (err?.response) {
    const data = err.response.data;
    if (data && typeof data.message === 'string' && data.message.trim()) {
      return data.message;
    }
    const status = err.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to perform this action.';
    if (status === 404) return 'The requested record was not found.';
    if (status === 409) return 'The record was changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The submitted data is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Network error. Please check your connection and try again.';
  return err?.message || fallback;
};

/* Consolidated read-only view of existing rate data: tests (GET /tests with
   server-side search/category/status), panels (GET /tests/panels) and
   packages (GET /tests/packages). Every displayed value comes from those
   API responses — nothing is computed, priced or invented here, and this
   screen performs no writes (create/edit stays in the existing masters). */
const RateList = () => {
  // Server state — tests are re-fetched per filter (server-side params);
  // panels/packages/categories load once (those endpoints take no params).
  const [tests, setTests] = useState([]);
  const [panels, setPanels] = useState([]);
  const [packages, setPackages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  // Separate errors per fetch group so one group's success never clears
  // the other's failure; the banner shows whichever is set.
  const [testsError, setTestsError] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Filters — search/category/status are server-side GET /tests params.
  // type is applied to the assembled rows; panels/packages are filtered
  // client-side on fields their documents actually carry (name, status).
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  // Panels, packages and category options — loaded once per mount/refresh.
  useEffect(() => {
    let active = true;
    (async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      const results = await Promise.allSettled([
        getPanels(),
        getPackages(),
        getCategories()
      ]);
      if (!active) return;
      const [panelsRes, packagesRes, categoriesRes] = results;
      setPanels(
        panelsRes.status === 'fulfilled' && Array.isArray(panelsRes.value?.data)
          ? panelsRes.value.data
          : []
      );
      setPackages(
        packagesRes.status === 'fulfilled' && Array.isArray(packagesRes.value?.data)
          ? packagesRes.value.data
          : []
      );
      // Category options are filter-only and non-critical (left empty on
      // failure, same as Normal Range Management).
      if (categoriesRes.status === 'fulfilled' && Array.isArray(categoriesRes.value?.data)) {
        setCategories(
          categoriesRes.value.data.map((c) => ({ value: c._id, label: c.name }))
        );
      }
      if (panelsRes.status === 'rejected') {
        setCatalogError(getApiErrorMessage(panelsRes.reason, 'Failed to load panels.'));
      } else if (packagesRes.status === 'rejected') {
        setCatalogError(getApiErrorMessage(packagesRes.reason, 'Failed to load packages.'));
      } else {
        setCatalogError(null);
      }
      setCatalogLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Category only exists on test documents — panels and packages carry no
  // category field, so the category select is hidden (and ignored) whenever
  // the type filter excludes tests.
  const categoryApplies = typeFilter === 'all' || typeFilter === 'Test';
  const activeCategory = categoryApplies ? categoryFilter : '';

  // Tests — server-side search/category/status (existing GET /tests params).
  // Skipped entirely when the type filter excludes tests.
  useEffect(() => {
    let active = true;
    (async () => {
      const includeTests = typeFilter === 'all' || typeFilter === 'Test';
      if (!includeTests) {
        setTests([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      setTestsError(null);
      const params = {};
      if (debouncedSearch.trim()) params.search = debouncedSearch.trim();
      if (activeCategory) params.category = activeCategory;
      if (statusFilter) params.status = statusFilter;
      try {
        const res = await getTests(params);
        if (!active) return;
        setTests(Array.isArray(res?.data) ? res.data : []);
      } catch (err) {
        if (!active) return;
        setTests([]);
        setTestsError(getApiErrorMessage(err, 'Failed to load test rates.'));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [debouncedSearch, activeCategory, statusFilter, typeFilter, reloadKey]);

  const refresh = () => {
    setReloadKey((key) => key + 1);
  };

  // Filter handlers reset pagination like the billing ledger does.
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };
  const handleTypeChange = (e) => {
    setTypeFilter(e.target.value);
    setPage(1);
  };
  const handleCategoryChange = (e) => {
    setCategoryFilter(e.target.value);
    setPage(1);
  };
  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPage(1);
  };

  const loadError = catalogError || testsError;
  const hasFilters = Boolean(
    debouncedSearch.trim() || activeCategory || statusFilter || typeFilter !== 'all'
  );

  // Unified rows — API fields only. Tests arrive already server-filtered;
  // panels/packages have no search/status/category query params, so those
  // filters run client-side on fields their documents actually carry.
  const query = debouncedSearch.trim().toLowerCase();
  const matchesCatalogFilters = (item) =>
    (!query || String(item.name || '').toLowerCase().includes(query)) &&
    (!statusFilter || item.status === statusFilter);

  const rows = [];
  if (typeFilter === 'all' || typeFilter === 'Test') {
    tests.forEach((test) => {
      rows.push({
        id: `test-${test._id}`,
        name: test.name || '—',
        code: test.code || '—',
        type: 'Test',
        category: test.category?.name || '—',
        price: test.price,
        status: test.status
      });
    });
  }
  // A selected category excludes panels/packages: those documents carry no
  // category, so they cannot match the filter.
  if ((typeFilter === 'all' || typeFilter === 'Panel') && !activeCategory) {
    panels.filter(matchesCatalogFilters).forEach((panel) => {
      rows.push({
        id: `panel-${panel._id}`,
        name: panel.name || '—',
        code: '—', // panels have no code field
        type: 'Panel',
        category: '—', // panels have no category field
        price: panel.price,
        status: panel.status
      });
    });
  }
  if ((typeFilter === 'all' || typeFilter === 'Package') && !activeCategory) {
    packages.filter(matchesCatalogFilters).forEach((pkg) => {
      rows.push({
        id: `package-${pkg._id}`,
        name: pkg.name || '—',
        code: '—', // packages have no code field
        type: 'Package',
        category: '—', // packages have no category field
        price: pkg.price,
        status: pkg.status
      });
    });
  }
  rows.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  // Client-side page slice (see PAGE_SIZE). Clamping keeps the current page
  // valid when a filter shrinks the result set.
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const visibleRows = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const headers = ['Name', 'Code', 'Type', 'Category', 'Rate', 'Status'];

  const renderRow = (row) => (
    <tr key={row.id}>
      <td style={{ fontWeight: '600' }}>{row.name}</td>
      <td>{row.code}</td>
      <td>{row.type}</td>
      <td>{row.category}</td>
      <td style={{ fontWeight: '600' }}>{formatCurrency(row.price)}</td>
      <td>
        <StatusBadge status={row.status} />
      </td>
    </tr>
  );

  return (
    <div className="rate-list-page">
      <PageHeader
        title="Unified Rate List"
        subtitle="Consolidated view of configured test, panel, and package rates."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={16} />}
            onClick={refresh}
            disabled={loading || catalogLoading}
          >
            Refresh
          </Button>
        }
      />

      {loadError ? (
        <div className="rl-banner rl-banner-error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{loadError}</span>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="rl-filters">
            <Select
              label="Type"
              name="typeFilter"
              value={typeFilter}
              onChange={handleTypeChange}
              options={TYPE_OPTIONS}
              placeholder=""
            />
            {categoryApplies ? (
              <Select
                label="Category"
                name="categoryFilter"
                value={categoryFilter}
                onChange={handleCategoryChange}
                options={categories}
                placeholder="All categories"
              />
            ) : null}
            <Select
              label="Status"
              name="statusFilter"
              value={statusFilter}
              onChange={handleStatusChange}
              options={STATUS_OPTIONS}
              placeholder="All statuses"
            />
          </div>

          <DataTable
            headers={headers}
            data={visibleRows}
            loading={loading || catalogLoading}
            emptyTitle={hasFilters ? 'No matching rates' : 'No rates found'}
            emptyMessage={
              hasFilters
                ? 'No tests, panels, or packages match your current search or filters.'
                : 'No test, panel, or package rates are configured yet.'
            }
            searchValue={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search by name or code..."
            pagination={{
              total,
              page: currentPage,
              limit: PAGE_SIZE,
              pages,
              onPageChange: setPage
            }}
            renderRow={renderRow}
          />
        </>
      )}
    </div>
  );
};

export default RateList;
