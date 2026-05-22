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
import React, { useState, useCallback } from 'react';
import {
  Button,
  Col,
  Divider,
  InfoTooltip,
  Input,
  Row,
  Select,
} from '@superset-ui/core/components';
import { t } from '@apache-superset/core/translation';
import { styled } from '@apache-superset/core/theme';
import { Icons } from '@superset-ui/core/components/Icons';
import BoundsControl from '../BoundsControl';
import CheckboxControl from '../CheckboxControl';
import ControlPopover from '../ControlPopover/ControlPopover';

interface TimeSeriesColumnControlProps {
  label?: string;
  tooltip?: string;
  colType?: string;
  width?: string;
  height?: string;
  timeLag?: string | number;
  timeRatio?: string;
  comparisonType?: string;
  showYAxis?: boolean;
  yAxisBounds?: (number | null)[];
  bounds?: (number | null)[];
  d3format?: string;
  dateFormat?: string;
  sparkType?: string;
  onChange?: (state: TimeSeriesColumnControlState) => void;
}

interface TimeSeriesColumnControlState {
  label: string;
  tooltip: string;
  colType: string;
  width: string;
  height: string;
  timeLag: string | number;
  timeRatio: string;
  comparisonType: string;
  showYAxis: boolean;
  yAxisBounds: (number | null)[];
  bounds: (number | null)[];
  d3format: string;
  dateFormat: string;
  sparkType: string;
  popoverVisible: boolean;
}

const defaultProps = {
  label: t('Time series columns'),
  tooltip: '',
  colType: '',
  width: '',
  height: '',
  timeLag: '',
  timeRatio: '',
  comparisonType: '',
  showYAxis: false,
  yAxisBounds: [null, null] as (number | null)[],
  bounds: [null, null] as (number | null)[],
  d3format: '',
  dateFormat: '',
  sparkType: 'line',
};

const comparisonTypeOptions = [
  { value: 'value', label: t('Actual value'), key: 'value' },
  { value: 'diff', label: t('Difference'), key: 'diff' },
  { value: 'perc', label: t('Percentage'), key: 'perc' },
  { value: 'perc_change', label: t('Percentage change'), key: 'perc_change' },
];

const colTypeOptions = [
  { value: 'time', label: t('Time comparison'), key: 'time' },
  { value: 'contrib', label: t('Contribution'), key: 'contrib' },
  { value: 'spark', label: t('Sparkline'), key: 'spark' },
  { value: 'avg', label: t('Period average'), key: 'avg' },
];

const sparkTypeOptions = [
  { value: 'line', label: t('Line Chart'), key: 'line' },
  { value: 'bar', label: t('Bar Chart'), key: 'bar' },
  { value: 'area', label: t('Area Chart'), key: 'area' },
];

const StyledRow = styled(Row)`
  margin-top: ${({ theme }) => theme.sizeUnit * 2}px;
  display: flex;
  align-items: center;
`;

const StyledCol = styled(Col)`
  display: flex;
  align-items: center;
`;

const StyledTooltip = styled(InfoTooltip)`
  margin-left: ${({ theme }) => theme.sizeUnit}px;
  color: ${({ theme }) => theme.colorIcon};
`;

const ButtonBar = styled.div`
  margin-top: ${({ theme }) => theme.sizeUnit * 5}px;
  display: flex;
  justify-content: center;
`;

const TimeSeriesColumnControl: React.FC<TimeSeriesColumnControlProps> = ({
  label: labelProp = defaultProps.label,
  tooltip: tooltipProp = defaultProps.tooltip,
  colType: colTypeProp = defaultProps.colType,
  width: widthProp = defaultProps.width,
  height: heightProp = defaultProps.height,
  timeLag: timeLagProp = defaultProps.timeLag,
  timeRatio: timeRatioProp = defaultProps.timeRatio,
  comparisonType: comparisonTypeProp = defaultProps.comparisonType,
  showYAxis: showYAxisProp = defaultProps.showYAxis,
  yAxisBounds: yAxisBoundsProp = defaultProps.yAxisBounds,
  bounds: boundsProp = defaultProps.bounds,
  d3format: d3formatProp = defaultProps.d3format,
  dateFormat: dateFormatProp = defaultProps.dateFormat,
  sparkType: sparkTypeProp = defaultProps.sparkType,
  onChange,
}) => {
  const getInitialState = useCallback(
    (): TimeSeriesColumnControlState => ({
      label: labelProp,
      tooltip: tooltipProp,
      colType: colTypeProp,
      width: widthProp,
      height: heightProp,
      timeLag: timeLagProp,
      timeRatio: timeRatioProp,
      comparisonType: comparisonTypeProp,
      showYAxis: showYAxisProp,
      yAxisBounds: yAxisBoundsProp,
      bounds: boundsProp,
      d3format: d3formatProp,
      dateFormat: dateFormatProp,
      sparkType: sparkTypeProp,
      popoverVisible: false,
    }),
    [
      labelProp,
      tooltipProp,
      colTypeProp,
      widthProp,
      heightProp,
      timeLagProp,
      timeRatioProp,
      comparisonTypeProp,
      showYAxisProp,
      yAxisBoundsProp,
      boundsProp,
      d3formatProp,
      dateFormatProp,
      sparkTypeProp,
    ],
  );

  const [state, setState] = useState<TimeSeriesColumnControlState>(
    getInitialState,
  );

  const resetState = useCallback(() => {
    setState(getInitialState());
  }, [getInitialState]);

  const onSave = useCallback(() => {
    onChange?.(state);
    setState(prev => ({ ...prev, popoverVisible: false }));
  }, [onChange, state]);

  const onClose = useCallback(() => {
    resetState();
  }, [resetState]);

  const onSelectChange = useCallback((attr: string, opt: string) => {
    setState(prev => ({ ...prev, [attr]: opt }));
  }, []);

  const onTextInputChange = useCallback(
    (attr: string, event: React.ChangeEvent<HTMLInputElement>) => {
      setState(prev => ({ ...prev, [attr]: event.target.value }));
    },
    [],
  );

  const onCheckboxChange = useCallback((attr: string, value: boolean) => {
    setState(prev => ({ ...prev, [attr]: value }));
  }, []);

  const onBoundsChange = useCallback((bounds: (number | null)[]) => {
    setState(prev => ({ ...prev, bounds }));
  }, []);

  const onPopoverVisibleChange = useCallback(
    (popoverVisible: boolean) => {
      if (popoverVisible) {
        setState(prev => ({ ...prev, popoverVisible }));
      } else {
        resetState();
      }
    },
    [resetState],
  );

  const onYAxisBoundsChange = useCallback(
    (yAxisBounds: (number | null)[]) => {
      setState(prev => ({ ...prev, yAxisBounds }));
    },
    [],
  );

  const formRow = (
    label: string,
    tooltip: string,
    ttLabel: string,
    control: React.ReactNode,
  ) => (
    <StyledRow>
      <StyledCol xs={24} md={11}>
        {label}
        <StyledTooltip placement="top" tooltip={tooltip} label={ttLabel} />
      </StyledCol>
      <Col xs={24} md={13}>
        {control}
      </Col>
    </StyledRow>
  );

  const renderPopover = () => (
    <div id="ts-col-popo" style={{ width: 320 }}>
      {formRow(
        t('Label'),
        t('The column header label'),
        'time-lag',
        <Input
          value={state.label}
          onChange={e => onTextInputChange('label', e)}
          placeholder={t('Label')}
        />,
      )}
      {formRow(
        t('Tooltip'),
        t('Column header tooltip'),
        'col-tooltip',
        <Input
          value={state.tooltip}
          onChange={e => onTextInputChange('tooltip', e)}
          placeholder={t('Tooltip')}
        />,
      )}
      {formRow(
        t('Type'),
        t('Type of comparison, value difference or percentage'),
        'col-type',
        <Select
          ariaLabel={t('Type')}
          value={state.colType || undefined}
          onChange={v => onSelectChange('colType', v)}
          options={colTypeOptions}
        />,
      )}
      <Divider />
      {state.colType === 'spark' &&
        formRow(
          t('Chart type'),
          t('Type of chart to display in sparkline'),
          'spark-type',
          <Select
            ariaLabel={t('Chart Type')}
            value={state.sparkType || undefined}
            onChange={v => onSelectChange('sparkType', v)}
            options={sparkTypeOptions}
          />,
        )}
      {state.colType === 'spark' &&
        formRow(
          t('Width'),
          t('Width of the sparkline'),
          'spark-width',
          <Input
            value={state.width}
            onChange={e => onTextInputChange('width', e)}
            placeholder={t('Width')}
          />,
        )}
      {state.colType === 'spark' &&
        formRow(
          t('Height'),
          t('Height of the sparkline'),
          'spark-width',
          <Input
            value={state.height}
            onChange={e => onTextInputChange('height', e)}
            placeholder={t('Height')}
          />,
        )}
      {['time', 'avg'].indexOf(state.colType) >= 0 &&
        formRow(
          t('Time lag'),
          t(
            'Number of periods to compare against. You can use negative numbers to compare from the beginning of the time range.',
          ),
          'time-lag',
          <Input
            value={state.timeLag}
            onChange={e => onTextInputChange('timeLag', e)}
            placeholder={t('Time Lag')}
          />,
        )}
      {['spark'].indexOf(state.colType) >= 0 &&
        formRow(
          t('Time ratio'),
          t('Number of periods to ratio against'),
          'time-ratio',
          <Input
            value={state.timeRatio}
            onChange={e => onTextInputChange('timeRatio', e)}
            placeholder={t('Time Ratio')}
          />,
        )}
      {state.colType === 'time' &&
        formRow(
          t('Type'),
          t('Type of comparison, value difference or percentage'),
          'comp-type',
          <Select
            ariaLabel={t('Type')}
            value={state.comparisonType || undefined}
            onChange={v => onSelectChange('comparisonType', v)}
            options={comparisonTypeOptions}
          />,
        )}
      {state.colType === 'spark' &&
        formRow(
          t('Show Y-axis'),
          t(
            'Show Y-axis on the sparkline. Will display the manually set min/max if set or min/max values in the data otherwise.',
          ),
          'show-y-axis-bounds',
          <CheckboxControl
            value={state.showYAxis}
            onChange={v => onCheckboxChange('showYAxis', v)}
          />,
        )}
      {state.colType === 'spark' &&
        formRow(
          t('Y-axis bounds'),
          t('Manually set min/max values for the y-axis.'),
          'y-axis-bounds',
          <BoundsControl
            value={state.yAxisBounds}
            onChange={onYAxisBoundsChange}
          />,
        )}
      {state.colType !== 'spark' &&
        formRow(
          t('Color bounds'),
          t(`Number bounds used for color encoding from red to blue.
               Reverse the numbers for blue to red. To get pure red or blue,
               you can enter either only min or max.`),
          'bounds',
          <BoundsControl value={state.bounds} onChange={onBoundsChange} />,
        )}
      {formRow(
        t('Number format'),
        t('Optional d3 number format string'),
        'd3-format',
        <Input
          value={state.d3format}
          onChange={e => onTextInputChange('d3format', e)}
          placeholder={t('Number format string')}
        />,
      )}
      {state.colType === 'spark' &&
        formRow(
          t('Date format'),
          t('Optional d3 date format string'),
          'date-format',
          <Input
            value={state.dateFormat}
            onChange={e => onTextInputChange('dateFormat', e)}
            placeholder={t('Date format string')}
          />,
        )}
      <ButtonBar>
        <Button buttonSize="small" onClick={onClose} cta>
          {t('Close')}
        </Button>
        <Button
          buttonStyle="primary"
          buttonSize="small"
          onClick={onSave}
          cta
        >
          {t('Save')}
        </Button>
      </ButtonBar>
    </div>
  );

  return (
    <span>
      {`${labelProp}`}{' '}
      <ControlPopover
        trigger="click"
        content={renderPopover()}
        title={t('Column Configuration')}
        open={state.popoverVisible}
        onOpenChange={onPopoverVisibleChange}
      >
        <span
          css={theme => ({
            display: 'inline-block',
            cursor: 'pointer',
            '& svg path': {
              fill: theme.colorIcon,
              transition: `fill ${theme.motionDurationMid} ease-out`,
            },
            '&:hover svg path': {
              fill: theme.colorPrimary,
            },
          })}
        >
          <Icons.EditOutlined iconSize="s" />
        </span>
      </ControlPopover>
    </span>
  );
};

export default TimeSeriesColumnControl;
