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
  value: valueProp,
  datasource,
  default: defaultProp = { type: controlTypes.fixed, value: 5 },
  ...rest
}: FixedOrMetricControlProps) {
  const initialType = (valueProp?.type ??
    defaultProp?.type ??
    controlTypes.fixed) as 'fix' | 'metric';
  const rawValue = valueProp?.value ?? defaultProp?.value ?? '100';
  const initialFixedValue =
    initialType === controlTypes.fixed && typeof rawValue !== 'object'
      ? rawValue
      : '';
  const initialMetricValue =
    initialType === controlTypes.metric && typeof rawValue === 'object'
      ? (rawValue as MetricValue)
      : null;

  const [type, setTypeState] = useState<'fix' | 'metric'>(initialType);
  const [fixedValue, setFixedValueState] = useState<string | number>(
    initialFixedValue,
  );
  const [metricValue, setMetricValueState] = useState<MetricValue | null>(
    initialMetricValue,
  );

  const pendingChange = useRef(false);

  const fireOnChange = useCallback(() => {
    onChange({
      type,
      value:
        type === controlTypes.fixed
          ? fixedValue
          : (metricValue ?? undefined),
    });
  }, [onChange, type, fixedValue, metricValue]);

  useEffect(() => {
    if (pendingChange.current) {
      fireOnChange();
      pendingChange.current = false;
    }
  }, [type, fixedValue, metricValue, fireOnChange]);

  const setType = useCallback((t: 'fix' | 'metric') => {
    pendingChange.current = true;
    setTypeState(t);
  }, []);

  const setFixedValue = useCallback((v: string | number) => {
    pendingChange.current = true;
    setFixedValueState(v);
  }, []);

  const setMetric = useCallback((v: MetricValue | null) => {
    pendingChange.current = true;
    setMetricValueState(v);
  }, []);

  const displayValue = valueProp ?? defaultProp;
  const displayType = displayValue?.type ?? controlTypes.fixed;
  const columns = datasource ? datasource.columns : null;
  const metrics = datasource ? datasource.metrics : null;

  return (
    <div>
      <ControlHeader
        {...rest}
        onChange={onChange}
        value={valueProp}
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
