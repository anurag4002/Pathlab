import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getReports } from '../../services/reportService';
import { getCategories, getTests } from '../../services/testService';
import formatCurrency from '../../utils/formatCurrency';
import formatDate from '../../utils/formatDate';
import useDebounce from '../../hooks/useDebounce';
import usePagination from '../../hooks/usePagination';
import { SvgBars } from '../../components/charts/SvgCharts';
import {
  Button,
  DataTable,
  EmptyState,
  LoadingSpinner,
  PageHeader,
  Select,
  StatCard,
  StatusBadge
} from '../../components/common';

const hasValue = (value) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));

const formatApiCount = (value) => (hasValue(value) ? String(value) : '—');
const formatApiCurrency = (value) => (hasValue(value) ? formatCurrency(value) : '—');

const getApiErrorMessage = (error, fallback) => {
  if (error?.response) {
    const message = error.response.data?.message;
    if (typeof message === 'string' && message.trim()) return message;

    const status = error.response.status;
    if (status === 401) return 'Your session has expired. Please log in again.';
    if (status === 403) return 'You do not have permission to view test analysis.';
    if (status === 404) return 'The requested test-analysis record was not found.';
    if (status === 409) return 'The test data changed elsewhere. Please refresh and try again.';
    if (status === 422) return 'The selected test filter is invalid.';
    if (status >= 500) return 'Server error. Please try again.';
    return fallback;
  }

  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.request) return 'Network error. Please check your connection and try again.';
  return error?.message || fallback;
};

const ErrorBanner = ({ message, onRetry }) => (
  <div
    role="alert"
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-3)',
      marginBottom: 'var(--space-4)',
      color: 'var(--color-danger)',
      backgroundColor: 'var(--color-danger-bg)',
      border: '1px solid var(--color-danger-border)',
      borderRadius: 'var(--radius-sm)'
    }}
  >
    <span>{message}</span>
    {onRetry && (
      <Button
        variant="secondary"
        size="sm"
        icon={<RefreshCw size={14} />}
        onClick={onRetry}
        style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}
      >
        Retry
      </Button>
    )}
  </div>
);

const SectionHeading = ({ title, description }) => (
  <div style={{ marginBottom: 'var(--space-3)' }}>
    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 'var(--font-weight-bold)' }}>{title}</h3>
    {description && (
      <p style={{ margin: '4px 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
        {description}
      </p>
    )}
  </div>
);

const getIdentifier = (value) => {
  if (value && typeof value === 'object') return value._id || value.id || null;
  return value || null;
};

const getTestDetails = (value, testMap) => {
  const testId = getIdentifier(value);
  const linkedTest = value && typeof value === 'object' ? value : null;
  const master = testId ? testMap.get(String(testId)) : null;
  return {
    name: master?.name || linkedTest?.name || null,
    code: master?.code || linkedTest?.code || null,
    category: master?.category?.name || linkedTest?.category?.name || null
  };
};

const getReportTestLabel = (report, testMap) => {
  const labels = [];
  const results = Array.isArray(report?.results) ? report.results : [];

  results.forEach((result) => {
    const details = getTestDetails(result?.test, testMap);
    const name = details.name || result?.testName;
    const label = name && details.code ? `${name} (${details.code})` : name;
    if (label && !labels.includes(label)) labels.push(label);
  });

  if (labels.length > 0) return labels.join(', ');
  if (report?.test && typeof report.test === 'object') {
    return report.test.code
      ? `${report.test.name || '—'} (${report.test.code})`
      : report.test.name || '—';
  }
  return '—';
};

const getReportEntryCount = (report) => {
  if (Array.isArray(report?.results) && report.results.length > 0) return report.results.length;
  if (report?.test && typeof report.test === 'object') return 1;
  return 0;
};

/* This is catalog composition, not usage: it counts the complete test-master
   response and never uses report pages to infer historical test volume. */
const getCatalogCategoryRows = (tests) => {
  if (!Array.isArray(tests)) return [];
  const grouped = new Map();

  tests.forEach((test) => {
    const category = test?.category?.name;
    if (!category) return;
    grouped.set(category, (grouped.get(category) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((left, right) => right.count - left.count || left.category.localeCompare(right.category));
};

const TestAnalysis = () => {
  const [allTests, setAllTests] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [indexLoading, setIndexLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [indexError, setIndexError] = useState(null);
  const [catalogError, setCatalogError] = useState(null);
  const [categoriesError, setCategoriesError] = useState(null);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [reports, setReports] = useState([]);
  const [reportPagination, setReportPagination] = useState(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState(null);
  const { page, limit, setPage } = usePagination(1, 25);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    setAllTests(null);
    setCategories([]);
    setIndexError(null);
    setCategoriesError(null);
    setIndexLoading(true);

    Promise.allSettled([getTests(), getCategories()]).then(([testsResult, categoriesResult]) => {
      if (!active) return;

      if (testsResult.status === 'fulfilled' && Array.isArray(testsResult.value?.data)) {
        setAllTests(testsResult.value.data);
      } else {
        setIndexError(
          getApiErrorMessage(
            testsResult.status === 'rejected' ? testsResult.reason : null,
            'Failed to load the test catalog index.'
          )
        );
      }

      if (categoriesResult.status === 'fulfilled' && Array.isArray(categoriesResult.value?.data)) {
        setCategories(categoriesResult.value.data);
      } else {
        setCategoriesError(
          getApiErrorMessage(
            categoriesResult.status === 'rejected' ? categoriesResult.reason : null,
            'Failed to load test categories.'
          )
        );
      }
    }).finally(() => {
      if (active) setIndexLoading(false);
    });

    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let active = true;
    setCatalog([]);
    setCatalogError(null);
    setCatalogLoading(true);

    getTests({
      search: debouncedSearch || undefined,
      category: categoryFilter || undefined,
      status: statusFilter || undefined
    }).then((response) => {
      if (!active) return;
      if (response?.success && Array.isArray(response.data)) {
        setCatalog(response.data);
      } else {
        setCatalogError('The test catalog service returned an unsuccessful response.');
      }
    }).catch((error) => {
      if (active) {
        setCatalogError(getApiErrorMessage(error, 'Failed to load the filtered test catalog.'));
      }
    }).finally(() => {
      if (active) setCatalogLoading(false);
    });

    return () => {
      active = false;
    };
  }, [debouncedSearch, categoryFilter, statusFilter, refreshKey]);

  useEffect(() => {
    let active = true;
    setReports([]);
    setReportPagination(null);
    setReportError(null);
    setReportLoading(true);

    getReports({ page, limit }).then((response) => {
      if (!active) return;

      if (response?.success && response.data && Array.isArray(response.data.reports)) {
        const pagination = response.data.pagination;
        if (!pagination || typeof pagination !== 'object') {
          setReportError('The report service did not return pagination metadata.');
          return;
        }
        const targetPage = Math.max(1, Math.min(page, pagination.pages || 1));
        if (targetPage !== page) {
          setPage(targetPage);
          return;
        }
        setReports(response.data.reports);
        setReportPagination(pagination);
      } else {
        setReportError('The report service returned an unsuccessful response.');
      }
    }).catch((error) => {
      if (active) {
        setReportError(getApiErrorMessage(error, 'Failed to load report activity.'));
      }
    }).finally(() => {
      if (active) setReportLoading(false);
    });

    return () => {
      active = false;
    };
  }, [page, limit, refreshKey, setPage]);

  const testMap = useMemo(() => {
    const map = new Map();
    (Array.isArray(allTests) ? allTests : []).forEach((test) => {
      if (test?._id) map.set(String(test._id), test);
    });
    return map;
  }, [allTests]);

  const categoryRows = useMemo(() => getCatalogCategoryRows(allTests), [allTests]);
  const statusOptions = useMemo(() => {
    const statuses = new Set();
    (Array.isArray(allTests) ? allTests : []).forEach((test) => {
      if (test?.status) statuses.add(String(test.status));
    });
    return Array.from(statuses).map((status) => ({ value: status, label: status }));
  }, [allTests]);

  const reportReady = !reportLoading && !reportError && reportPagination !== null;
  const handleRefresh = () => {
    setAllTests(null);
    setCatalog([]);
    setCategories([]);
    setReports([]);
    setReportPagination(null);
    setIndexError(null);
    setCatalogError(null);
    setCategoriesError(null);
    setReportError(null);
    setIndexLoading(true);
    setCatalogLoading(true);
    setReportLoading(true);
    setRefreshKey((value) => value + 1);
  };

  const handleSearchChange = (event) => {
    setCatalog([]);
    setCatalogError(null);
    setCatalogLoading(true);
    setSearch(event.target.value);
  };

  const handleCategoryChange = (event) => {
    setCatalog([]);
    setCatalogError(null);
    setCatalogLoading(true);
    setCategoryFilter(event.target.value);
  };

  const handleStatusChange = (event) => {
    setCatalog([]);
    setCatalogError(null);
    setCatalogLoading(true);
    setStatusFilter(event.target.value);
  };

  const handlePageChange = (nextPage) => {
    if (nextPage === page) return;
    setReports([]);
    setReportError(null);
    setReportLoading(true);
    setPage(nextPage);
  };

  const categoryChartData = categoryRows.map((row) => ({
    label: row.category,
    value: row.count
  }));

  return (
    <div>
      <PageHeader
        title="Test Analysis"
        subtitle="Operational view of report-linked test activity and the configured test catalog"
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={handleRefresh}
            disabled={indexLoading || catalogLoading || reportLoading}
          >
            Refresh
          </Button>
        }
      />

      <div
        className="card"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-4)',
          flexWrap: 'wrap',
          marginBottom: 'var(--space-4)'
        }}
      >
        <div>
          <span style={{ display: 'block', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' }}>
            Reporting scope
          </span>
          <strong style={{ fontSize: 'var(--font-size-lg)' }}>All report history exposed by the API</strong>
        </div>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}>
          Current report page: {page}
        </span>
      </div>

      <div
        role="note"
        className="card"
        style={{ marginBottom: 'var(--space-4)', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-sm)' }}
      >
        The report activity endpoint does not expose a date range, test/category/status filter, or aggregate endpoint. The report table below is server-paginated; catalog filters use the separate supported test-catalog parameters. No unsupported date or historical test total is inferred.
      </div>

      {indexError && <ErrorBanner message={indexError} onRetry={handleRefresh} />}
      {categoriesError && <ErrorBanner message={categoriesError} onRetry={handleRefresh} />}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)'
        }}
      >
        <StatCard title="Report records available" value={formatApiCount(reportReady ? reportPagination?.total : undefined)} />
        <StatCard title="Reports on current page" value={formatApiCount(reportReady && Array.isArray(reports) ? reports.length : undefined)} />
        <StatCard title="Catalog test records" value={formatApiCount(Array.isArray(allTests) ? allTests.length : undefined)} color="var(--color-primary)" bgColor="var(--color-primary-light)" />
        <StatCard title="Configured categories" value={formatApiCount(Array.isArray(categories) ? categories.length : undefined)} />
      </div>

      <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <SectionHeading
          title="Catalog composition by category"
          description="Counts configured test definitions from the complete test-master response. This is catalog composition, not tests performed or usage frequency; entries without a category are not assigned a synthetic category."
        />
        {indexError ? null : indexLoading ? (
          <LoadingSpinner label="Loading test catalog composition..." />
        ) : categoryRows.length === 0 ? (
          <EmptyState
            title="No catalog categories"
            message="The test API returned no categorized test definitions."
          />
        ) : (
          <>
            <div style={{ overflowX: 'auto', marginBottom: 'var(--space-4)' }}>
              <SvgBars data={categoryChartData} height={210} color="var(--color-info)" />
            </div>
            <DataTable
              headers={['Category', 'Configured test records']}
              data={categoryRows}
              emptyMessage="No catalog category composition was returned."
              renderRow={(row) => (
                <tr key={row.category}>
                  <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{row.category}</td>
                  <td style={{ fontWeight: 'var(--font-weight-bold)' }}>{formatApiCount(row.count)}</td>
                </tr>
              )}
            />
          </>
        )}
      </section>

      <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <SectionHeading
          title="Report activity records"
          description="Server-paginated report metadata and the API-provided test/result names for each record. Patient names, result values, and medical flags are intentionally not displayed in this aggregate view."
        />
        {reportError ? (
          <ErrorBanner message={reportError} onRetry={handleRefresh} />
        ) : (
          <DataTable
            headers={['Report date', 'API test/result names', 'API entries', 'Status']}
            data={reports}
            loading={reportLoading}
            emptyTitle="No report records"
            emptyMessage="The report API returned no records."
            pagination={reportPagination ? { ...reportPagination, onPageChange: handlePageChange } : undefined}
            renderRow={(report) => (
              <tr key={report._id}>
                <td>{formatDate(report.reportDate)}</td>
                <td>{getReportTestLabel(report, testMap)}</td>
                <td>{formatApiCount(getReportEntryCount(report))}</td>
                <td>{report.status ? <StatusBadge status={report.status} /> : '—'}</td>
              </tr>
            )}
          />
        )}
      </section>

      <section className="card" style={{ marginBottom: 'var(--space-4)' }}>
        <SectionHeading
          title="Test catalog"
          description="Actual test master data from the existing catalog API. Catalog rates are configuration values, not test-wise revenue."
        />
        {catalogError && <ErrorBanner message={catalogError} onRetry={handleRefresh} />}
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          <Select
            name="test-analysis-category"
            label="Category"
            value={categoryFilter}
            onChange={handleCategoryChange}
            options={categories.map((category) => ({ value: category._id, label: category.name }))}
            placeholder="All categories"
            disabled={categories.length === 0}
            style={{ minWidth: '200px', marginBottom: 0 }}
          />
          <Select
            name="test-analysis-status"
            label="Status"
            value={statusFilter}
            onChange={handleStatusChange}
            options={statusOptions}
            placeholder="All statuses"
            disabled={statusOptions.length === 0}
            style={{ minWidth: '160px', marginBottom: 0 }}
          />
        </div>
        {!catalogError && (
          <DataTable
            headers={['Test name', 'Code', 'Category', 'Catalog rate', 'Status']}
            data={catalog}
            loading={catalogLoading}
            emptyTitle="No matching tests"
            emptyMessage="No test catalog records matched the selected filters."
            searchValue={search}
            onSearchChange={handleSearchChange}
            searchPlaceholder="Search by test name or code..."
            renderRow={(test) => (
              <tr key={test._id}>
                <td style={{ fontWeight: 'var(--font-weight-semibold)' }}>{test.name || '—'}</td>
                <td>{test.code || '—'}</td>
                <td>{test.category?.name || '—'}</td>
                <td>{formatApiCurrency(test.price)}</td>
                <td>{test.status ? <StatusBadge status={test.status} /> : '—'}</td>
              </tr>
            )}
          />
        )}
        <p style={{ margin: 'var(--space-3) 0 0', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
          The test catalog endpoint has no pagination metadata; the table displays the filtered records returned by that API.
        </p>
      </section>

      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-xs)' }}>
        No test-wise usage total, test-level revenue, panel/package usage, modality, referral, patient-count, or clinical abnormality analysis is inferred. The current APIs do not provide those aggregates, and no test-analysis export endpoint exists; this screen does not generate substitute data.
      </p>
    </div>
  );
};

export default TestAnalysis;
