import React, {useState} from 'react';
import {DataComponent, DataTable, Filters, MetricCard, Section, SectionHeader, useDataApp, useSectionFilters} from '../../data-app-public.jsx';

export function TaskRegister() {
  const {reviewedRows} = useDataApp();
  const [selectedId, setSelectedId] = useState(null);
  const scope = useSectionFilters(['project', 'status', 'kind'].map(field => ({id: `task-${field}`, label: {project: 'Project', status: 'Status', kind: 'Type'}[field], field, defaultValue: 'all', queryIds: ['task_register']})), {}, {id: 'shared-task-register'});
  const props = scope.componentProps('task_register', ['project', 'status', 'kind']);
  const rows = props.displayRows;
  const selected = rows.find(row => row.id === selectedId);
  const requirements = reviewedRows('requirements_register');
  const requirementRows = selected ? requirements.filter(r => selected.requirementIds.includes(r.id)) : requirements;
  const coverage = reviewedRows('task_source_coverage');
  return <div className="dashboard-view">
    <Section>
      <SectionHeader id="task-register-heading" title="Tasks and requirements" filters={<Filters {...scope.filterProps} />} />
      <div className="integration-metrics">
        <MetricCard id="metric-register-tasks" queryId="task_register" sourceRows={rows} title="Tasks in view" value={String(rows.length)} />
        <MetricCard id="metric-register-verification" queryId="task_register" sourceRows={rows} title="Verification pending" value={String(rows.filter(r => r.status === 'Verification pending').length)} />
        <MetricCard id="metric-register-recorded" queryId="task_register" sourceRows={rows} title="Current-source development verification" value={String(rows.filter(r => r.status === 'Development verified').length)} description="Current-source work receipts, required checks and artifact hashes match. Provider acceptance remains separate." />
      </div>
      <DataComponent id="task-register" queryId="task_register" title="All recorded project tasks" kind="table" variant="card" {...props} displayRows={rows} sourceRows={rows}>
        <div data-reviewed-rows><DataTable rows={rows} rowKey="id" selectedRowKey={selectedId} onRowSelect={row => setSelectedId(row.id)} rowActionLabel={row => `Read requirements for ${row.title}`} label="Project task register" searchable columns={[
          {key: 'project', label: 'Project'}, {key: 'status', label: 'Status'}, {key: 'title', label: 'Task'},
          {key: 'kind', label: 'Type'}, {key: 'requirements', label: 'Requirements'},
        ]} /></div>
      </DataComponent>
      {selected && <DataComponent id="selected-task-detail" queryId="task_register" title={selected.title} kind="table" variant="card" displayRows={[selected]} sourceRows={[selected]}>
        <div data-reviewed-rows>
          <p>{selected.description}</p><p><strong>Next action</strong> {selected.nextAction}</p>
          <p>{selected.evidenceNote}</p><p className="evidence-technical">{selected.sourceReference}</p>
          <a href={`/api/v1/tasks/${encodeURIComponent(selected.id)}`} target="_blank" rel="noreferrer">Read the full task through the API</a>
        </div>
      </DataComponent>}
    </Section>
    <Section>
      <SectionHeader id="requirements-register-heading" title={selected ? 'Requirements for the selected task' : 'Requirements and verification gates'} />
      <DataComponent id="requirements-register" queryId="requirements_register" title="Source requirements" kind="table" variant="card" displayRows={requirementRows} sourceRows={requirementRows}>
        <div data-reviewed-rows><DataTable rows={requirementRows} label="Requirements and verification gates" searchable columns={[
          {key: 'project', label: 'Project'}, {key: 'kind', label: 'Type'}, {key: 'text', label: 'Requirement'},
          {key: 'linkedTasks', label: 'Linked tasks'}, {key: 'sourceReference', label: 'Source'},
        ]} /></div>
      </DataComponent>
    </Section>
    <Section>
      <SectionHeader id="task-source-coverage-heading" title="Source freshness" />
      <DataComponent id="task-source-coverage" queryId="task_source_coverage" title="Sources read for this snapshot" kind="table" variant="card" displayRows={coverage} sourceRows={coverage}>
        <div data-reviewed-rows><DataTable rows={coverage} label="Source coverage" searchable={false} columns={[
          {key: 'project', label: 'Project'}, {key: 'source', label: 'Source'}, {key: 'status', label: 'Result'}, {key: 'retrievedAt', label: 'Read at (UTC)'},
        ]} /></div>
      </DataComponent>
      <p data-editable-narrative data-editable-id="task-register-refresh-note">The register is a published snapshot. Sync and redeploy after task changes. Historical development verification, source-reported completion, and provider approval have separate evidence.</p>
      <p><a href="/api/v1" target="_blank" rel="noreferrer">API endpoints</a> · <a href="/api/openapi.json" target="_blank" rel="noreferrer">OpenAPI definition</a> · <a href="/api/v1/context" target="_blank" rel="noreferrer">Full AI context</a></p>
    </Section>
  </div>;
}
