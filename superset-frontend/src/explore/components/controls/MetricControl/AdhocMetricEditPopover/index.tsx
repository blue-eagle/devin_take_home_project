/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
/* eslint-disable camelcase */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { isDefined, ensureIsArray, DatasourceType } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import type { editors } from '@apache-superset/core';
import { styled } from '@apache-superset/core/theme';
import Tabs from '@superset-ui/core/components/Tabs';
import {
  Button,
  EmptyState,
  Form,
  FormItem,
  Icons,
  Select,
  Tooltip,
} from '@superset-ui/core/components';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { noOp } from 'src/utils/common';
import {
  AGGREGATES_OPTIONS,
  POPOVER_INITIAL_HEIGHT,
  POPOVER_INITIAL_WIDTH,
} from 'src/explore/constants';
import AdhocMetric, {
  EXPRESSION_TYPES,
} from 'src/explore/components/controls/MetricControl/AdhocMetric';
import {
  StyledMetricOption,
  StyledColumnOption,
} from 'src/explore/components/optionRenderers';
import { getColumnKeywords } from 'src/explore/controlUtils/getColumnKeywords';
import SQLEditorWithValidation from 'src/components/SQLEditorWithValidation';

interface ColumnType {
  column_name: string;
  verbose_name?: string;
  [key: string]: unknown;
}

interface SavedMetricType {
  metric_name: string;
  verbose_name?: string;
  expression?: string;
  [key: string]: unknown;
}

interface DatasourceInfo {
  type?: DatasourceType | string;
  id?: number | string;
  extra?: string;
  [key: string]: unknown;
}

interface ExtraConfig {
  disallow_adhoc_metrics?: boolean;
  [key: string]: unknown;
}

type Metric = AdhocMetric | SavedMetricType;

interface AdhocMetricEditPopoverProps {
  onChange: (newMetric: Metric, oldMetric?: Metric) => void;
  onClose: () => void;
  onResize: () => void;
  getCurrentTab?: (tab: string) => void;
  getCurrentLabel?: (labels: {
    savedMetricLabel?: string;
    adhocMetricLabel?: string;
  }) => void;
  handleDatasetModal?: (open: boolean) => void;
  adhocMetric: AdhocMetric;
  columns?: ColumnType[];
  savedMetricsOptions?: SavedMetricType[];
  savedMetric?: SavedMetricType;
  datasource?: DatasourceInfo;
  isNewMetric?: boolean;
  isLabelModified?: boolean;
  compatibleMetrics?: string[] | null;
}

const StyledSelect = styled(Select)`
  .metric-option {
    & > svg {
      min-width: ${({ theme }) => `${theme.sizeUnit * 4}px`};
    }
    & > .option-label {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

export const SAVED_TAB_KEY = 'SAVED';

function getDefaultTab(props: AdhocMetricEditPopoverProps): string {
  const { adhocMetric, savedMetric, savedMetricsOptions, isNewMetric } = props;
  if (isDefined(adhocMetric.column) || isDefined(adhocMetric.sqlExpression)) {
    return adhocMetric.expressionType;
  }
  if (
    (isNewMetric || savedMetric?.metric_name) &&
    Array.isArray(savedMetricsOptions) &&
    savedMetricsOptions.length > 0
  ) {
    return SAVED_TAB_KEY;
  }
  return adhocMetric.expressionType;
}

export function AdhocMetricEditPopover({
  onChange,
  onClose,
  onResize,
  getCurrentTab = noOp,
  getCurrentLabel,
  handleDatasetModal,
  adhocMetric: propsAdhocMetric,
  columns = [],
  savedMetricsOptions,
  savedMetric: propsSavedMetric,
  datasource,
  isNewMetric = false,
  isLabelModified,
  compatibleMetrics,
  ...popoverProps
}: AdhocMetricEditPopoverProps) {
  const [adhocMetric, setAdhocMetric] = useState<AdhocMetric>(propsAdhocMetric);
  const [savedMetric, setSavedMetric] = useState<SavedMetricType | undefined>(
    propsSavedMetric,
  );
  const [width, setWidth] = useState(POPOVER_INITIAL_WIDTH);
  const [height, setHeight] = useState(POPOVER_INITIAL_HEIGHT);

  const editorRef = useRef<editors.EditorHandle>(null);
  const dragStartX = useRef(0);
  const dragStartY = useRef(0);
  const dragStartWidth = useRef(0);
  const dragStartHeight = useRef(0);
  const onMouseMoveRef = useRef<(e: MouseEvent) => void>(() => {});

  const defaultActiveTabKey = getDefaultTab({
    onChange,
    onClose,
    onResize,
    getCurrentTab,
    getCurrentLabel,
    handleDatasetModal,
    adhocMetric: propsAdhocMetric,
    columns,
    savedMetricsOptions,
    savedMetric: propsSavedMetric,
    datasource,
    isNewMetric,
    isLabelModified,
    compatibleMetrics,
  });

  useEffect(() => {
    getCurrentTab?.(defaultActiveTabKey);
  }, []);

  const prevAdhocMetric = useRef(adhocMetric);
  const prevSavedMetric = useRef(savedMetric);

  useEffect(() => {
    if (
      prevAdhocMetric.current?.sqlExpression !== adhocMetric?.sqlExpression ||
      prevAdhocMetric.current?.aggregate !== adhocMetric?.aggregate ||
      prevAdhocMetric.current?.column?.column_name !==
        adhocMetric?.column?.column_name ||
      prevSavedMetric.current?.metric_name !== savedMetric?.metric_name
    ) {
      getCurrentLabel?.({
        savedMetricLabel:
          savedMetric?.verbose_name || savedMetric?.metric_name,
        adhocMetricLabel: adhocMetric?.getDefaultLabel(),
      });
    }
    prevAdhocMetric.current = adhocMetric;
    prevSavedMetric.current = savedMetric;
  }, [adhocMetric, savedMetric, getCurrentLabel]);

  const onMouseMove = useCallback(
    (e: MouseEvent) => {
      onResize();
      setWidth(
        Math.max(
          dragStartWidth.current + (e.clientX - dragStartX.current),
          POPOVER_INITIAL_WIDTH,
        ),
      );
      setHeight(
        Math.max(
          dragStartHeight.current + (e.clientY - dragStartY.current),
          POPOVER_INITIAL_HEIGHT,
        ),
      );
    },
    [onResize],
  );
  onMouseMoveRef.current = onMouseMove;

  const onMouseUp = useCallback(() => {
    document.removeEventListener('mousemove', onMouseMoveRef.current);
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('mousemove', onMouseMoveRef.current);
    };
  }, [onMouseUp]);

  const onSave = useCallback(() => {
    const metric = savedMetric?.metric_name ? savedMetric : adhocMetric;
    const oldMetric = propsSavedMetric?.metric_name
      ? propsSavedMetric
      : propsAdhocMetric;
    onChange({ ...metric } as Metric, oldMetric as Metric);
    onClose();
  }, [
    savedMetric,
    adhocMetric,
    propsSavedMetric,
    propsAdhocMetric,
    onChange,
    onClose,
  ]);

  const onResetStateAndClose = useCallback(() => {
    setAdhocMetric(propsAdhocMetric);
    setSavedMetric(propsSavedMetric);
    onClose();
  }, [propsAdhocMetric, propsSavedMetric, onClose]);

  const onColumnChange = useCallback(
    (columnName: string) => {
      const column = columns?.find(c => c.column_name === columnName);
      setAdhocMetric(prev =>
        prev.duplicateWith({
          column,
          expressionType: EXPRESSION_TYPES.SIMPLE,
        }),
      );
      setSavedMetric(undefined);
    },
    [columns],
  );

  const onAggregateChange = useCallback((aggregate: string | null) => {
    setAdhocMetric(prev =>
      prev.duplicateWith({
        aggregate,
        expressionType: EXPRESSION_TYPES.SIMPLE,
      }),
    );
    setSavedMetric(undefined);
  }, []);

  const onSavedMetricChange = useCallback(
    (savedMetricName: string) => {
      const sm = savedMetricsOptions?.find(
        m => m.metric_name === savedMetricName,
      );
      setSavedMetric(sm);
      setAdhocMetric(prev =>
        prev.duplicateWith({
          column: undefined,
          aggregate: undefined,
          sqlExpression: undefined,
          expressionType: EXPRESSION_TYPES.SIMPLE,
        }),
      );
    },
    [savedMetricsOptions],
  );

  const onSqlExpressionChange = useCallback((sqlExpression: string) => {
    setAdhocMetric(prev =>
      prev.duplicateWith({
        sqlExpression,
        expressionType: EXPRESSION_TYPES.SQL,
      }),
    );
    setSavedMetric(undefined);
  }, []);

  const onDragDown = useCallback(
    (e: React.MouseEvent) => {
      dragStartX.current = e.clientX;
      dragStartY.current = e.clientY;
      dragStartWidth.current = width;
      dragStartHeight.current = height;
      document.addEventListener('mousemove', onMouseMoveRef.current);
    },
    [width, height],
  );

  const refreshEditor = useCallback(() => {
    setTimeout(() => {
      editorRef.current?.resize();
    }, 0);
  }, []);

  const onTabChange = useCallback(
    (tab: string) => {
      refreshEditor();
      getCurrentTab?.(tab);
    },
    [refreshEditor, getCurrentTab],
  );

  const renderColumnOption = (option: ColumnType): React.ReactNode => {
    const column = { ...option };
    if (
      (column as unknown as { metric_name?: string }).metric_name &&
      !column.verbose_name
    ) {
      column.verbose_name = (
        column as unknown as { metric_name: string }
      ).metric_name;
    }
    return <StyledColumnOption column={column} showType />;
  };

  const renderMetricOption = (sm: SavedMetricType): React.ReactNode => (
    <StyledMetricOption metric={sm} showType />
  );

  const columnsArray = columns ?? [];
  const keywords = sqlKeywords.concat(
    getColumnKeywords(columnsArray as Parameters<typeof getColumnKeywords>[0]),
  );

  const columnValue =
    (adhocMetric.column && adhocMetric.column.column_name) ||
    adhocMetric.inferSqlExpressionColumn();

  const columnSelectProps = {
    ariaLabel: t('Select column'),
    placeholder: t('%s column(s)', columnsArray.length),
    value: columnValue,
    onChange: onColumnChange,
    allowClear: true,
    autoFocus: !columnValue,
  };

  const aggregateSelectProps = {
    ariaLabel: t('Select aggregate options'),
    placeholder: t('%s aggregates(s)', AGGREGATES_OPTIONS.length),
    value:
      adhocMetric.aggregate ??
      adhocMetric.inferSqlExpressionAggregate() ??
      undefined,
    onChange: onAggregateChange as (value: unknown) => void,
    allowClear: true,
    autoFocus: !!columnValue,
  };

  const savedSelectProps = {
    ariaLabel: t('Select saved metrics'),
    placeholder: t('%s saved metric(s)', savedMetricsOptions?.length ?? 0),
    value: savedMetric?.metric_name,
    onChange: onSavedMetricChange,
    allowClear: true,
    autoFocus: true,
  };

  const stateIsValid = adhocMetric.isValid() || savedMetric?.metric_name;
  const hasUnsavedChanges =
    isLabelModified ||
    isNewMetric ||
    !adhocMetric.equals(propsAdhocMetric) ||
    (!(
      typeof savedMetric?.metric_name === 'undefined' &&
      typeof propsSavedMetric?.metric_name === 'undefined'
    ) &&
      savedMetric?.metric_name !== propsSavedMetric?.metric_name);

  let extra: ExtraConfig = {};
  if (datasource?.extra && typeof datasource.extra === 'string') {
    try {
      extra = JSON.parse(datasource.extra) as ExtraConfig;
    } catch {} // eslint-disable-line no-empty
  }

  return (
    <Form
      layout="vertical"
      id="metrics-edit-popover"
      data-test="metrics-edit-popover"
      {...popoverProps}
    >
      <Tabs
        id="adhoc-metric-edit-tabs"
        data-test="adhoc-metric-edit-tabs"
        defaultActiveKey={defaultActiveTabKey}
        className="adhoc-metric-edit-tabs"
        style={{ height, width }}
        onChange={onTabChange}
        allowOverflow
        items={[
          {
            key: SAVED_TAB_KEY,
            label: t('Saved'),
            children:
              ensureIsArray(savedMetricsOptions).length > 0 ? (
                <FormItem label={t('Saved metric')}>
                  <StyledSelect
                    options={[...ensureIsArray(savedMetricsOptions)]
                      .sort((a, b) =>
                        (a.metric_name ?? '').localeCompare(
                          b.metric_name ?? '',
                        ),
                      )
                      .map(sm => ({
                        value: sm.metric_name,
                        label: renderMetricOption(sm),
                        key: sm.id,
                        metric_name: sm.metric_name,
                        verbose_name: sm.verbose_name ?? '',
                        disabled:
                          compatibleMetrics != null &&
                          !compatibleMetrics.includes(sm.metric_name),
                      }))}
                    optionFilterProps={['metric_name', 'verbose_name']}
                    {...savedSelectProps}
                  />
                </FormItem>
              ) : datasource?.type === DatasourceType.Table ? (
                <EmptyState
                  image="empty.svg"
                  size="small"
                  title={t('No saved metrics found')}
                  description={t(
                    'Add metrics to dataset in "Edit datasource" modal',
                  )}
                />
              ) : (
                <EmptyState
                  image="empty.svg"
                  size="small"
                  title={t('No saved metrics found')}
                  description={
                    <>
                      <span
                        tabIndex={0}
                        role="button"
                        onClick={() => {
                          handleDatasetModal?.(true);
                          onClose();
                        }}
                      >
                        {t('Create a dataset')}
                      </span>
                      {t(' to add metrics')}
                    </>
                  }
                />
              ),
          },
          {
            key: EXPRESSION_TYPES.SIMPLE,
            label: extra.disallow_adhoc_metrics ? (
              <Tooltip
                title={t(
                  'Simple ad-hoc metrics are not enabled for this dataset',
                )}
              >
                {t('Simple')}
              </Tooltip>
            ) : (
              t('Simple')
            ),
            disabled: extra.disallow_adhoc_metrics,
            children: (
              <>
                <FormItem label={t('column')}>
                  <Select
                    options={columnsArray.map(column => ({
                      value: column.column_name,
                      key: (column as { id?: unknown }).id,
                      label: renderColumnOption(column),
                      column_name: column.column_name,
                      verbose_name: column.verbose_name ?? '',
                    }))}
                    optionFilterProps={['column_name', 'verbose_name']}
                    {...columnSelectProps}
                  />
                </FormItem>
                <FormItem label={t('aggregate')}>
                  <Select
                    options={AGGREGATES_OPTIONS.map(option => ({
                      value: option,
                      label: option,
                      key: option,
                    }))}
                    {...aggregateSelectProps}
                  />
                </FormItem>
              </>
            ),
          },
          {
            key: EXPRESSION_TYPES.SQL,
            label: extra.disallow_adhoc_metrics ? (
              <Tooltip
                title={t(
                  'Custom SQL ad-hoc metrics are not enabled for this dataset',
                )}
              >
                {t('Custom SQL')}
              </Tooltip>
            ) : (
              t('Custom SQL')
            ),
            disabled: extra.disallow_adhoc_metrics,
            children: (
              <SQLEditorWithValidation
                data-test="sql-editor"
                ref={editorRef}
                keywords={keywords}
                height={`${height - 120}px`}
                onChange={onSqlExpressionChange}
                width="100%"
                lineNumbers={false}
                value={
                  adhocMetric.sqlExpression ||
                  adhocMetric.translateToSql({ transformCountDistinct: true })
                }
                wordWrap
                showValidation
                expressionType="metric"
                datasourceId={datasource?.id}
                datasourceType={datasource?.type}
              />
            ),
          },
        ]}
      />
      <div>
        <Button
          buttonSize="small"
          buttonStyle="secondary"
          onClick={onResetStateAndClose}
          data-test="AdhocMetricEdit#cancel"
          cta
        >
          {t('Close')}
        </Button>
        <Button
          disabled={!stateIsValid || !hasUnsavedChanges}
          buttonStyle="primary"
          buttonSize="small"
          data-test="AdhocMetricEdit#save"
          onClick={onSave}
          cta
        >
          {t('Save')}
        </Button>
        <Icons.ArrowsAltOutlined
          role="button"
          aria-label={t('Resize')}
          tabIndex={0}
          onMouseDown={onDragDown}
          className="edit-popover-resize"
        />
      </div>
    </Form>
  );
}

function AdhocMetricEditPopoverWithRedux(
  props: Omit<AdhocMetricEditPopoverProps, 'compatibleMetrics'>,
) {
  const compatibleMetrics = useSelector(
    (state: { explore?: { compatibleMetrics?: string[] | null } }) =>
      state.explore?.compatibleMetrics,
  );
  return (
    <AdhocMetricEditPopover {...props} compatibleMetrics={compatibleMetrics} />
  );
}

export { AdhocMetricEditPopover };
export default AdhocMetricEditPopoverWithRedux;
