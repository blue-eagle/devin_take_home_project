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
import { useState, useCallback, useEffect, useRef } from 'react';
import { t } from '@apache-superset/core/translation';
import { Collapse, Label } from '@superset-ui/core/components';
import TextControl from 'src/explore/components/controls/TextControl';
import MetricsControl from 'src/explore/components/controls/MetricControl/MetricsControl';
import ControlHeader from 'src/explore/components/ControlHeader';
import PopoverSection from '@superset-ui/core/components/PopoverSection';

const controlTypes = {
  fixed: 'fix',
  metric: 'metric',
} as const;

interface ControlValue {
  type?: 'fix' | 'metric';
  value?:
    | string
    | number
    | { label?: string; expressionType?: string; sqlExpression?: string };
}

interface MetricValue {
  label?: string;
  expressionType?: string;
  sqlExpression?: string;
  [key: string]: unknown;
}

interface DatasourceType {
  columns?: { column_name: string }[];
  metrics?: { metric_name: string; expression: string }[];
  [key: string]: unknown;
}

interface FixedOrMetricControlProps {
  onChange?: (value: ControlValue) => void;
  value?: ControlValue;
  isFloat?: boolean;
  datasource: DatasourceType;
  default?: ControlValue;
}

export default function FixedOrMetricControl({
  onChange = () => {},
  value: propValue,
  isFloat,
  datasource,
  default: defaultValue = { type: controlTypes.fixed, value: 5 },
}: FixedOrMetricControlProps) {
  const initType = (propValue?.type ??
    defaultValue?.type ??
    controlTypes.fixed) as 'fix' | 'metric';
  const rawValue = propValue?.value ?? defaultValue?.value ?? '100';
  const initFixedValue =
    initType === controlTypes.fixed && typeof rawValue !== 'object'
      ? rawValue
      : '';
  const initMetricValue =
    initType === controlTypes.metric && typeof rawValue === 'object'
      ? (rawValue as MetricValue)
      : null;

  const [type, setTypeState] = useState<'fix' | 'metric'>(initType);
  const [fixedValue, setFixedValueState] = useState<string | number>(initFixedValue);
  const [metricValue, setMetricValueState] = useState<MetricValue | null>(initMetricValue);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const notifyChange = useCallback(
    (t: 'fix' | 'metric', fv: string | number, mv: MetricValue | null) => {
      onChangeRef.current({
        type: t,
        value: t === controlTypes.fixed ? fv : (mv ?? undefined),
      });
    },
    [],
  );

  const setType = useCallback(
    (newType: 'fix' | 'metric') => {
      setTypeState(newType);
      notifyChange(newType, fixedValue, metricValue);
    },
    [fixedValue, metricValue, notifyChange],
  );

  const setFixedValue = useCallback(
    (val: string | number) => {
      setFixedValueState(val);
      notifyChange(type, val, metricValue);
    },
    [type, metricValue, notifyChange],
  );

  const setMetric = useCallback(
    (val: MetricValue | null) => {
      setMetricValueState(val);
      notifyChange(type, fixedValue, val);
    },
    [type, fixedValue, notifyChange],
  );

  const value = propValue ?? defaultValue;
  const displayType = value?.type ?? controlTypes.fixed;
  const columns = datasource ? datasource.columns : null;
  const metrics = datasource ? datasource.metrics : null;

  return (
    <div>
      <ControlHeader
        onChange={onChange}
        value={propValue}
        isFloat={isFloat}
        datasource={datasource}
      />
      <Collapse
        ghost
        items={[
          {
            key: 'fixed-or-metric',
            showArrow: false,
            label: (
              <Label>
                {type === controlTypes.fixed && (
                  <span>{fixedValue}</span>
                )}
                {type === controlTypes.metric && (
                  <span>
                    <span>{t('metric')}: </span>
                    <strong>
                      {metricValue ? metricValue.label : null}
                    </strong>
                  </span>
                )}
              </Label>
            ),
            children: (
              <div className="well">
                <PopoverSection
                  title={t('Fixed')}
                  isSelected={displayType === controlTypes.fixed}
                  onSelect={() => {
                    setType(controlTypes.fixed);
                  }}
                >
                  <TextControl
                    isFloat
                    onChange={setFixedValue}
                    onFocus={() => {
                      setType(controlTypes.fixed);
                      return {};
                    }}
                    value={fixedValue}
                  />
                </PopoverSection>
                <PopoverSection
                  title={t('Based on a metric')}
                  isSelected={displayType === controlTypes.metric}
                  onSelect={() => {
                    setType(controlTypes.metric);
                  }}
                >
                  <MetricsControl
                    name="metric"
                    columns={columns ?? undefined}
                    savedMetrics={metrics ?? undefined}
                    multi={false}
                    onFocus={() => {
                      setType(controlTypes.metric);
                    }}
                    onChange={setMetric}
                    value={metricValue}
                    datasource={datasource}
                  />
                </PopoverSection>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
