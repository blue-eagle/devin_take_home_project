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
import React, { useCallback, useEffect, useRef } from 'react';
import { ErrorInfo } from 'react';
import { logging } from '@apache-superset/core/utils';
import { t } from '@apache-superset/core/translation';
import {
  ensureIsArray,
  FeatureFlag,
  isFeatureEnabled,
  QueryFormData,
  SqlaFormData,
  ClientErrorObject,
  DataRecordFilters,
  type FilterState,
  type JsonObject,
  type AgGridChartState,
} from '@superset-ui/core';
import { styled } from '@apache-superset/core/theme';
import type { ChartState, Datasource, ChartStatus } from 'src/explore/types';
import { PLACEHOLDER_DATASOURCE } from 'src/dashboard/constants';
import { EmptyState, Loading } from '@superset-ui/core/components';
import { ErrorBoundary } from 'src/components';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { isCurrentUserBot } from 'src/utils/isBot';
import { ChartSource } from 'src/types/ChartSource';
import { ResourceStatus } from 'src/hooks/apiResources/apiResources';
import { Dispatch } from 'redux';
import ChartRenderer from './ChartRenderer';
import { ChartErrorMessage } from './ChartErrorMessage';
import { getChartRequiredFieldsMissingMessage } from '../../utils/getChartRequiredFieldsMissingMessage';

export type ChartErrorType = Partial<ClientErrorObject>;
export interface ChartProps {
  annotationData?: JsonObject;
  actions: Actions;
  chartId: number;
  datasource?: Datasource;
  dashboardId?: number;
  initialValues?: DataRecordFilters;
  formData: QueryFormData;
  labelColors?: string;
  sharedLabelColors?: string;
  width: number;
  height: number;
  setControlValue: (name: string, value: unknown) => void;
  timeout?: number;
  vizType: string;
  triggerRender?: boolean;
  force?: boolean;
  isFiltersInitialized?: boolean;
  chartAlert?: string;
  chartStatus?: ChartStatus;
  chartStackTrace?: string;
  queriesResponse: ChartState['queriesResponse'];
  latestQueryFormData?: ChartState['latestQueryFormData'];
  triggerQuery?: boolean;
  chartIsStale?: boolean;
  errorMessage?: React.ReactNode;
  addFilter?: (
    col: string,
    vals: unknown[],
    merge?: boolean,
    refresh?: boolean,
  ) => void;
  onQuery?: () => void;
  onFilterMenuOpen?: (chartId: number, column: string) => void;
  onFilterMenuClose?: (chartId: number, column: string) => void;
  ownState?: JsonObject;
  postTransformProps?: (props: JsonObject) => JsonObject;
  datasetsStatus?: 'loading' | 'error' | 'complete';
  isInView?: boolean;
  emitCrossFilters?: boolean;
  onChartStateChange?: (chartState: AgGridChartState) => void;
  suppressLoadingSpinner?: boolean;
  filterState?: FilterState;
}

export type Actions = {
  logEvent(
    LOG_ACTIONS_RENDER_CHART: string,
    arg1: {
      slice_id: number;
      has_err: boolean;
      error_details: string;
      start_offset: number;
      ts: number;
      duration: number;
    },
  ): Dispatch;
  chartRenderingFailed(
    arg0: string,
    chartId: number,
    arg2: string | null,
  ): Dispatch;
  chartRenderingSucceeded(chartId: number): Dispatch;
  postChartFormData(
    formData: SqlaFormData,
    arg1: boolean,
    timeout: number | undefined,
    chartId: number,
    dashboardId: number | undefined,
    ownState: JsonObject | undefined,
  ): Dispatch;
};
const BLANK = {};
const NONEXISTENT_DATASET = t(
  'The dataset associated with this chart no longer exists',
);

const defaultProps: Partial<ChartProps> = {
  addFilter: () => BLANK,
  onFilterMenuOpen: () => BLANK,
  onFilterMenuClose: () => BLANK,
  initialValues: BLANK,
  setControlValue: () => BLANK,
  triggerRender: false,
  dashboardId: undefined,
  chartStackTrace: undefined,
  force: false,
  isInView: true,
};

const Styles = styled.div<{ height: number; width?: number }>`
  min-height: ${p => p.height}px;
  position: relative;

  .chart-tooltip {
    opacity: 0.75;
    font-size: ${({ theme }) => theme.fontSizeSM}px;
  }

  .slice_container {
    display: flex;
    flex-direction: column;
    justify-content: center;

    height: ${p => p.height}px;

    .pivot_table tbody tr {
      font-feature-settings: 'tnum' 1;
    }

    .alert {
      margin: ${({ theme }) => theme.sizeUnit * 2}px;
    }
  }
`;

const LoadingDiv = styled.div`
  position: absolute;
  left: 50%;
  top: 50%;
  width: 80%;
  transform: translate(-50%, -50%);
`;

const ErrorContainer = styled.div<{ height: number }>`
  height: ${p => p.height}px;
  overflow: auto;
`;

const MessageSpan = styled.span`
  display: block;
  text-align: center;
  margin: ${({ theme }) => theme.sizeUnit * 4}px auto;
  width: fit-content;
  color: ${({ theme }) => theme.colorText};
`;

const Chart: React.FC<ChartProps> = React.memo(
  ({
    annotationData,
    actions,
    chartId,
    datasource,
    dashboardId = defaultProps.dashboardId,
    initialValues = defaultProps.initialValues,
    formData,
    labelColors,
    sharedLabelColors,
    width,
    height,
    setControlValue = defaultProps.setControlValue!,
    timeout,
    vizType,
    triggerRender = defaultProps.triggerRender,
    force = defaultProps.force,
    isFiltersInitialized,
    chartAlert,
    chartStatus,
    chartStackTrace = defaultProps.chartStackTrace,
    queriesResponse = [],
    latestQueryFormData,
    triggerQuery,
    chartIsStale,
    errorMessage,
    addFilter = defaultProps.addFilter,
    onQuery,
    onFilterMenuOpen = defaultProps.onFilterMenuOpen,
    onFilterMenuClose = defaultProps.onFilterMenuClose,
    ownState,
    postTransformProps,
    datasetsStatus,
    isInView = defaultProps.isInView,
    emitCrossFilters,
    onChartStateChange,
    suppressLoadingSpinner,
    filterState,
  }) => {
    const renderStartTime = useRef(Logger.getTimestamp());

    const shouldRenderChart = useCallback(
      () =>
        isInView ||
        !isFeatureEnabled(FeatureFlag.DashboardVirtualization) ||
        isCurrentUserBot(),
      [isInView],
    );

    const runQuery = useCallback(() => {
      if (
        isFeatureEnabled(FeatureFlag.DashboardVirtualizationDeferData) &&
        !shouldRenderChart()
      ) {
        return;
      }
      actions.postChartFormData(
        formData as SqlaFormData,
        Boolean(force || getUrlParam(URL_PARAMS.force)),
        timeout,
        chartId,
        dashboardId,
        ownState,
      );
    }, [
      shouldRenderChart,
      actions,
      formData,
      force,
      timeout,
      chartId,
      dashboardId,
      ownState,
    ]);

    useEffect(() => {
      if (triggerQuery) {
        runQuery();
      }
    });

    const handleRenderContainerFailure = useCallback(
      (error: Error, info: ErrorInfo) => {
        logging.warn(error);
        actions.chartRenderingFailed(
          error.toString(),
          chartId,
          info?.componentStack ?? null,
        );
        actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
          slice_id: chartId,
          has_err: true,
          error_details: error.toString(),
          start_offset: renderStartTime.current,
          ts: new Date().getTime(),
          duration: Logger.getTimestamp() - renderStartTime.current,
        });
      },
      [actions, chartId],
    );

    const renderErrorMessage = (queryResponse: ChartErrorType) => {
      const error = queryResponse?.errors?.[0];
      const message = chartAlert || queryResponse?.message;

      if (
        !error &&
        chartAlert !== undefined &&
        chartAlert !== NONEXISTENT_DATASET &&
        datasource === PLACEHOLDER_DATASOURCE &&
        datasetsStatus !== ResourceStatus.Error
      ) {
        return (
          <Styles
            key={chartId}
            data-ui-anchor="chart"
            className="chart-container"
            data-test="chart-container"
            height={height}
          >
            <Loading
              size={dashboardId ? 's' : 'm'}
              muted={!!dashboardId}
            />
          </Styles>
        );
      }

      return (
        <ChartErrorMessage
          key={chartId}
          chartId={chartId}
          error={error}
          subtitle={message}
          link={queryResponse ? queryResponse.link : undefined}
          source={dashboardId ? ChartSource.Dashboard : ChartSource.Explore}
          stackTrace={chartStackTrace}
        />
      );
    };

    const renderSpinner = (databaseName: string | undefined) => {
      const message = databaseName
        ? t('Waiting on %s', databaseName)
        : t('Waiting on database...');

      return (
        <LoadingDiv>
          <Loading
            position="inline-centered"
            size={dashboardId ? 's' : 'm'}
            muted={!!dashboardId}
          />
          <MessageSpan>{message}</MessageSpan>
        </LoadingDiv>
      );
    };

    const renderChartContainer = () => (
      <div className="slice_container" data-test="slice-container">
        {shouldRenderChart() ? (
          <ChartRenderer
            annotationData={annotationData}
            actions={actions}
            chartId={chartId}
            datasource={datasource}
            dashboardId={dashboardId}
            initialValues={initialValues}
            formData={formData}
            labelColors={labelColors}
            sharedLabelColors={sharedLabelColors}
            width={width}
            height={height}
            setControlValue={setControlValue}
            timeout={timeout}
            vizType={vizType}
            triggerRender={triggerRender}
            force={force}
            isFiltersInitialized={isFiltersInitialized}
            chartAlert={chartAlert}
            chartStatus={chartStatus}
            chartStackTrace={chartStackTrace}
            queriesResponse={queriesResponse}
            latestQueryFormData={latestQueryFormData}
            triggerQuery={triggerQuery}
            chartIsStale={chartIsStale}
            errorMessage={errorMessage}
            addFilter={addFilter}
            onQuery={onQuery}
            onFilterMenuOpen={onFilterMenuOpen}
            onFilterMenuClose={onFilterMenuClose}
            ownState={ownState}
            postTransformProps={postTransformProps}
            datasetsStatus={datasetsStatus}
            isInView={isInView}
            emitCrossFilters={emitCrossFilters}
            onChartStateChange={onChartStateChange}
            suppressLoadingSpinner={suppressLoadingSpinner}
            filterState={filterState}
            source={
              dashboardId ? ChartSource.Dashboard : ChartSource.Explore
            }
            data-test={vizType}
          />
        ) : (
          <Loading
            size={dashboardId ? 's' : 'm'}
            muted={!!dashboardId}
          />
        )}
      </div>
    );

    const databaseName =
      datasource?.parent?.name ??
      (datasource?.database?.name as string | undefined);

    const isLoading = chartStatus === 'loading';
    const showSpinner = isLoading && !suppressLoadingSpinner;

    if (chartStatus === 'failed') {
      return (
        <ErrorContainer height={height}>
          {queriesResponse?.map(item =>
            renderErrorMessage(item as ChartErrorType),
          )}
        </ErrorContainer>
      );
    }

    if (errorMessage && ensureIsArray(queriesResponse).length === 0) {
      return (
        <EmptyState
          size="large"
          title={t('Add required control values to preview chart')}
          description={getChartRequiredFieldsMissingMessage(true)}
          image="chart.svg"
        />
      );
    }
    if (
      !isLoading &&
      !chartAlert &&
      !errorMessage &&
      chartIsStale &&
      ensureIsArray(queriesResponse).length === 0
    ) {
      return (
        <EmptyState
          size="large"
          title={t('Your chart is ready to go!')}
          description={
            <span>
              {t(
                'Click on "Create chart" button in the control panel on the left to preview a visualization or',
              )}{' '}
              <span role="button" tabIndex={0} onClick={onQuery}>
                {t('click here')}
              </span>
              .
            </span>
          }
          image="chart.svg"
        />
      );
    }

    return (
      <ErrorBoundary
        onError={handleRenderContainerFailure}
        showMessage={false}
      >
        <Styles
          data-ui-anchor="chart"
          className="chart-container"
          data-test="chart-container"
          height={height}
          width={width}
        >
          {showSpinner
            ? renderSpinner(databaseName)
            : renderChartContainer()}
        </Styles>
      </ErrorBoundary>
    );
  },
);
export default Chart;
