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
import { ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { SupersetClient, ensureIsArray } from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { t } from '@apache-superset/core/translation';
import { withTheme, type SupersetTheme } from '@apache-superset/core/theme';

import ControlHeader from 'src/explore/components/ControlHeader';
import AdhocMetric, {
  isDictionaryForAdhocMetric,
} from 'src/explore/components/controls/MetricControl/AdhocMetric';
import {
  Operators,
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
} from 'src/explore/constants';
import FilterDefinitionOption from 'src/explore/components/controls/MetricControl/FilterDefinitionOption';
import {
  AddControlLabel,
  HeaderContainer,
  LabelsContainer,
} from 'src/explore/components/controls/OptionControls';
import { Icons } from '@superset-ui/core/components/Icons';
import { Modal } from '@superset-ui/core/components';
import AdhocFilterPopoverTrigger from 'src/explore/components/controls/FilterControl/AdhocFilterPopoverTrigger';
import AdhocFilterOption from 'src/explore/components/controls/FilterControl/AdhocFilterOption';
import AdhocFilter, {
  isDictionaryForAdhocFilter,
} from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { toQueryString } from 'src/utils/urlUtils';
import { Clauses, ExpressionTypes } from '../types';

interface ColumnMeta {
  column_name: string;
  verbose_name?: string;
  [key: string]: unknown;
}

interface SavedMetric {
  metric_name: string;
  expression: string;
  [key: string]: unknown;
}

interface Datasource {
  id?: number;
  type?: string;
  database?: { id: number };
  datasource_name?: string;
  catalog?: string;
  schema?: string;
  is_sqllab_view?: boolean;
  [key: string]: unknown;
}

export interface AdhocFilterControlProps {
  label?: ReactNode;
  name?: string;
  sections?: string[];
  operators?: string[];
  onChange?: (values: AdhocFilter[]) => void;
  value?: AdhocFilter[];
  datasource?: Datasource;
  columns?: ColumnMeta[];
  savedMetrics?: SavedMetric[];
  selectedMetrics?: string | AdhocMetric | (string | AdhocMetric)[];
  isLoading?: boolean;
  canDelete?: (
    filter: AdhocFilter,
    allFilters: AdhocFilter[],
  ) => string | boolean | undefined;
  theme?: SupersetTheme;
}

interface FilterOption {
  column_name?: string;
  saved_metric_name?: string;
  label?: string;
  filterOptionName?: string;
  [key: string]: unknown;
}

const { warning } = Modal;

function optionsForSelect(props: AdhocFilterControlProps): FilterOption[] {
  const options = [
    ...(props.columns || []),
    ...ensureIsArray(props.selectedMetrics).map(
      metric =>
        metric &&
        (typeof metric === 'string'
          ? { saved_metric_name: metric }
          : isDictionaryForAdhocMetric(metric)
            ? new AdhocMetric(metric)
            : metric),
    ),
  ].filter(option => option);

  return options
    .reduce<FilterOption[]>((results, option) => {
      const filterOption = option as FilterOption;
      if (filterOption.saved_metric_name) {
        results.push({
          ...filterOption,
          filterOptionName: filterOption.saved_metric_name,
        });
      } else if (filterOption.column_name) {
        results.push({
          ...filterOption,
          filterOptionName: `_col_${filterOption.column_name}`,
        });
      } else if (option instanceof AdhocMetric) {
        results.push({
          ...option,
          filterOptionName: `_adhocmetric_${option.label}`,
        } as FilterOption);
      }
      return results;
    }, [])
    .sort((a: FilterOption, b: FilterOption) =>
      (a.saved_metric_name || a.column_name || a.label || '').localeCompare(
        b.saved_metric_name || b.column_name || b.label || '',
      ),
    );
}

function AdhocFilterControl({
  name = '',
  onChange = () => {},
  columns = [],
  savedMetrics = [],
  selectedMetrics = [],
  label,
  sections,
  operators,
  value,
  datasource,
  isLoading,
  canDelete,
  theme,
  ...restProps
}: AdhocFilterControlProps) {
  const props = {
    name,
    onChange,
    columns,
    savedMetrics,
    selectedMetrics,
    label,
    sections,
    operators,
    value,
    datasource,
    isLoading,
    canDelete,
    theme,
    ...restProps,
  };

  const [values, setValues] = useState<AdhocFilter[]>(() =>
    (value || []).map(filter =>
      isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
    ),
  );
  const [options, setOptions] = useState<FilterOption[]>(() =>
    optionsForSelect(props),
  );
  const [partitionColumn, setPartitionColumn] = useState<string | null>(null);

  const prevColumns = useRef(columns);
  const prevValue = useRef(value);

  useEffect(() => {
    if (columns !== prevColumns.current) {
      setOptions(optionsForSelect(props));
      prevColumns.current = columns;
    }
  }, [columns]);

  useEffect(() => {
    if (value !== prevValue.current) {
      setValues(
        (value || []).map(filter =>
          isDictionaryForAdhocFilter(filter) ? new AdhocFilter(filter) : filter,
        ),
      );
      prevValue.current = value;
    }
  }, [value]);

  useEffect(() => {
    if (datasource && datasource.type === 'table') {
      const dbId = datasource.database?.id;
      const {
        datasource_name: dsName,
        catalog,
        schema,
        is_sqllab_view: isSqllabView,
      } = datasource;

      if (!isSqllabView && dbId && dsName && schema) {
        SupersetClient.get({
          endpoint: `/api/v1/database/${dbId}/table_metadata/extra/${toQueryString(
            {
              name: dsName,
              catalog,
              schema,
            },
          )}`,
        })
          .then(({ json }) => {
            if (json && json.partitions) {
              const { partitions } = json;
              if (
                partitions &&
                partitions.cols &&
                Object.keys(partitions.cols).length === 1
              ) {
                setPartitionColumn(partitions.cols[0]);
              }
            }
          })
          .catch(error => {
            logging.error('fetch extra_table_metadata:', error.statusText);
          });
      }
    }
  }, [datasource]);

  const getMetricExpression = useCallback(
    (savedMetricName: string): string => {
      const metric = savedMetrics?.find(
        sm => sm.metric_name === savedMetricName,
      );
      return metric?.expression ?? '';
    },
    [savedMetrics],
  );

  const mapOption = useCallback(
    (option: FilterOption | AdhocFilter): AdhocFilter | null => {
      if (option instanceof AdhocFilter) {
        return option;
      }
      if (option.saved_metric_name) {
        return new AdhocFilter({
          expressionType: ExpressionTypes.Sql,
          subject: getMetricExpression(option.saved_metric_name),
          operator:
            OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GreaterThan].operation,
          comparator: 0,
          clause: Clauses.Having,
        });
      }
      if (option.label) {
        return new AdhocFilter({
          expressionType: ExpressionTypes.Sql,
          subject: new AdhocMetric(option).translateToSql(),
          operator:
            OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.GreaterThan].operation,
          comparator: 0,
          clause: Clauses.Having,
        });
      }
      if (option.column_name) {
        return new AdhocFilter({
          expressionType: ExpressionTypes.Simple,
          subject: option.column_name,
          operator: OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.Equals].operation,
          comparator: '',
          clause: Clauses.Where,
          isNew: true,
        });
      }
      return null;
    },
    [getMetricExpression],
  );

  const removeFilter = useCallback(
    (index: number) => {
      const valuesCopy = [...values];
      valuesCopy.splice(index, 1);
      setValues(valuesCopy);
      onChange?.(valuesCopy);
    },
    [values, onChange],
  );

  const onRemoveFilter = useCallback(
    (index: number) => {
      const result = canDelete?.(values[index], values);
      if (typeof result === 'string') {
        warning({ title: t('Warning'), content: result });
        return;
      }
      removeFilter(index);
    },
    [canDelete, values, removeFilter],
  );

  const onFilterEdit = useCallback(
    (changedFilter: AdhocFilter) => {
      onChange?.(
        values.map(v => {
          if (v.filterOptionName === changedFilter.filterOptionName) {
            return changedFilter;
          }
          return v;
        }),
      );
    },
    [onChange, values],
  );

  const onNewFilter = useCallback(
    (newFilter: FilterOption | AdhocFilter) => {
      const mappedOption = mapOption(newFilter);
      if (mappedOption) {
        const newValues = [...values, mappedOption];
        setValues(newValues);
        onChange?.(newValues);
      }
    },
    [mapOption, values, onChange],
  );

  const moveLabel = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      const newValues = [...values];
      [newValues[hoverIndex], newValues[dragIndex]] = [
        newValues[dragIndex],
        newValues[hoverIndex],
      ];
      setValues(newValues);
    },
    [values],
  );

  const valueRenderer = (adhocFilter: AdhocFilter, index: number) => (
    <AdhocFilterOption
      key={index}
      index={index}
      adhocFilter={adhocFilter}
      onFilterEdit={onFilterEdit}
      options={options}
      sections={sections}
      operators={operators as Operators[] | undefined}
      datasource={datasource}
      onRemoveFilter={e => {
        e.stopPropagation();
        onRemoveFilter(index);
      }}
      onMoveLabel={moveLabel}
      onDropLabel={() => onChange?.(values)}
      partitionColumn={partitionColumn}
    />
  );

  const addNewFilterPopoverTrigger = (trigger: ReactNode) => (
    <AdhocFilterPopoverTrigger
      operators={operators as Operators[] | undefined}
      sections={sections}
      adhocFilter={new AdhocFilter({})}
      datasource={(datasource as Record<string, unknown>) || {}}
      options={options}
      onFilterEdit={onNewFilter}
      partitionColumn={partitionColumn ?? undefined}
    >
      {trigger}
    </AdhocFilterPopoverTrigger>
  );

  return (
    <div className="metrics-select" data-test="adhoc-filter-control">
      <HeaderContainer>
        <ControlHeader {...props} />
      </HeaderContainer>
      <LabelsContainer>
        {[
          ...(values.length > 0
            ? values.map((v, index) => valueRenderer(v, index))
            : []),
          addNewFilterPopoverTrigger(
            <AddControlLabel role="button" data-test="add-filter-button">
              <Icons.PlusOutlined iconSize="m" />
              {t('Add filter')}
            </AddControlLabel>,
          ),
        ]}
      </LabelsContainer>
    </div>
  );
}

export default withTheme(AdhocFilterControl);
