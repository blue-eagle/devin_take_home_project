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
import { snakeCase, isEqual, cloneDeep } from 'lodash';
import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  type RefObject,
  type MouseEvent,
  type ReactNode,
} from 'react';
import {
  SuperChart,
  Behavior,
  getChartMetadataRegistry,
  VizType,
  isFeatureEnabled,
  FeatureFlag,
  QueryFormData,
  AnnotationData,
  DataMask,
  QueryData,
  JsonObject,
  LatestQueryFormData,
  AgGridChartState,
  ContextMenuFilters,
  DataRecordFilters,
} from '@superset-ui/core';
import { logging } from '@apache-superset/core/utils';
import { t } from '@apache-superset/core/translation';
import { Logger, LOG_ACTIONS_RENDER_CHART } from 'src/logger/LogUtils';
import { EmptyState } from '@superset-ui/core/components';
import { ChartSource } from 'src/types/ChartSource';
import type { Datasource, ChartStatus } from 'src/explore/types';
import type { Dispatch } from 'redux';
import ChartContextMenu, {
  ChartContextMenuRef,
} from './ChartContextMenu/ChartContextMenu';

type FilterValue = string | number | boolean | null | undefined;

interface LegendState {
  [name: string]: boolean;
}

declare const __webpack_require__:
  | {
      h?: () => string;
    }
  | undefined;

interface ChartActions {
  chartRenderingSucceeded: (chartId: number) => Dispatch;
  chartRenderingFailed: (
    error: string,
    chartId: number,
    componentStack: string | null,
  ) => Dispatch;
  logEvent: (
    eventName: string,
    payload: {
      slice_id: number;
      viz_type?: string;
      start_offset: number;
      ts: number;
      duration: number;
      has_err?: boolean;
      error_details?: string;
    },
  ) => Dispatch;
  updateDataMask?: (chartId: number, dataMask: DataMask) => Dispatch;
}

interface OwnState {
  searchText?: string;
  agGridFilterModel?: Record<string, unknown>;
  [key: string]: unknown;
}

interface FilterState {
  value?: FilterValue[];
  [key: string]: unknown;
}

export interface ChartRendererProps {
  annotationData?: AnnotationData;
  actions: ChartActions;
  chartId: number;
  datasource?: Datasource;
  initialValues?: DataRecordFilters;
  formData: QueryFormData;
  latestQueryFormData?: LatestQueryFormData;
  labelsColor?: Record<string, string>;
  labelsColorMap?: Record<string, string>;
  height?: number;
  width?: number;
  setControlValue?: (name: string, value: unknown) => void;
  vizType: string;
  triggerRender?: boolean;
  chartAlert?: string;
  chartStatus?: ChartStatus | null;
  queriesResponse?: QueryData[] | null;
  triggerQuery?: boolean;
  chartIsStale?: boolean;
  addFilter?: (
    col: string,
    vals: FilterValue[],
    merge?: boolean,
    refresh?: boolean,
  ) => void;
  setDataMask?: (dataMask: DataMask) => void;
  onFilterMenuOpen?: (chartId: number, column: string) => void;
  onFilterMenuClose?: (chartId: number, column: string) => void;
  ownState?: OwnState;
  filterState?: FilterState;
  postTransformProps?: (props: JsonObject) => JsonObject;
  source?: ChartSource;
  emitCrossFilters?: boolean;
  cacheBusterProp?: string;
  onChartStateChange?: (chartState: AgGridChartState) => void;
  suppressLoadingSpinner?: boolean;
}

interface ChartHooks {
  onAddFilter: (
    col: string,
    vals: FilterValue[],
    merge?: boolean,
    refresh?: boolean,
  ) => void;
  onContextMenu?: (
    offsetX: number,
    offsetY: number,
    filters?: ContextMenuFilters,
  ) => void;
  onError: (error: Error, info: { componentStack: string } | null) => void;
  setControlValue: (name: string, value: unknown) => void;
  onFilterMenuOpen?: (chartId: number, column: string) => void;
  onFilterMenuClose?: (chartId: number, column: string) => void;
  onLegendStateChanged: (legendState: LegendState) => void;
  setDataMask: (dataMask: DataMask) => void;
  onLegendScroll: (legendIndex: number) => void;
  onChartStateChange?: (chartState: AgGridChartState) => void;
}

const BLANK = {};

const BIG_NO_RESULT_MIN_WIDTH = 300;
const BIG_NO_RESULT_MIN_HEIGHT = 220;

const behaviorsList = [Behavior.InteractiveChart];

const defaultProps: Partial<ChartRendererProps> = {
  addFilter: () => BLANK,
  onFilterMenuOpen: () => BLANK,
  onFilterMenuClose: () => BLANK,
  initialValues: BLANK,
  setControlValue: () => {},
  triggerRender: false,
};

function shouldUpdate(
  prevProps: ChartRendererProps,
  nextProps: ChartRendererProps,
): boolean {
  const resultsReady =
    nextProps.queriesResponse &&
    ['success', 'rendered'].indexOf(nextProps.chartStatus as string) > -1 &&
    !nextProps.queriesResponse?.[0]?.error;

  if (!resultsReady) {
    return false;
  }

  const hasQueryResponseChange =
    nextProps.queriesResponse !== prevProps.queriesResponse;

  const hasMatrixifyChanges = (): boolean => {
    const nextFormData = nextProps.formData as JsonObject;
    const currentFormData = prevProps.formData as JsonObject;
    const isMatrixifyEnabled =
      nextFormData.matrixify_enable === true &&
      ((nextFormData.matrixify_mode_rows !== undefined &&
        nextFormData.matrixify_mode_rows !== 'disabled') ||
        (nextFormData.matrixify_mode_columns !== undefined &&
          nextFormData.matrixify_mode_columns !== 'disabled'));
    if (!isMatrixifyEnabled) return false;

    const matrixifyKeys = Object.keys(nextFormData).filter(key =>
      key.startsWith('matrixify_'),
    );

    return matrixifyKeys.some(
      key => !isEqual(nextFormData[key], currentFormData[key]),
    );
  };

  const nextFormData = nextProps.formData as JsonObject;
  const currentFormData = prevProps.formData as JsonObject;

  return (
    hasQueryResponseChange ||
    !isEqual(nextProps.datasource, prevProps.datasource) ||
    nextProps.annotationData !== prevProps.annotationData ||
    nextProps.ownState !== prevProps.ownState ||
    nextProps.filterState !== prevProps.filterState ||
    nextProps.height !== prevProps.height ||
    nextProps.width !== prevProps.width ||
    nextProps.triggerRender === true ||
    nextProps.labelsColor !== prevProps.labelsColor ||
    nextProps.labelsColorMap !== prevProps.labelsColorMap ||
    nextFormData.color_scheme !== currentFormData.color_scheme ||
    nextFormData.stack !== currentFormData.stack ||
    nextFormData.subcategories !== currentFormData.subcategories ||
    nextProps.cacheBusterProp !== prevProps.cacheBusterProp ||
    nextProps.emitCrossFilters !== prevProps.emitCrossFilters ||
    nextProps.postTransformProps !== prevProps.postTransformProps ||
    hasMatrixifyChanges()
  );
}

const ChartRenderer: React.FC<ChartRendererProps> = React.memo(
  ({
    annotationData,
    actions,
    chartId,
    datasource,
    initialValues = BLANK,
    formData,
    latestQueryFormData,
    labelsColor,
    labelsColorMap,
    height,
    width,
    setControlValue = () => {},
    vizType,
    triggerRender = false,
    chartAlert,
    chartStatus,
    queriesResponse,
    triggerQuery,
    chartIsStale,
    addFilter = () => BLANK,
    setDataMask,
    onFilterMenuOpen = () => BLANK,
    onFilterMenuClose = () => BLANK,
    ownState,
    filterState,
    postTransformProps,
    source,
    emitCrossFilters,
    cacheBusterProp,
    onChartStateChange,
    suppressLoadingSpinner,
  }) => {
    const suppressContextMenu = getChartMetadataRegistry().get(
      formData.viz_type ?? vizType,
    )?.suppressContextMenu;

    const showContextMenu =
      source === ChartSource.Dashboard &&
      !suppressContextMenu &&
      isFeatureEnabled(FeatureFlag.DrillToDetail);

    const [inContextMenu, setInContextMenu] = useState(false);
    const [legendState, setLegendState] = useState<LegendState | undefined>(
      undefined,
    );
    const [legendIndex, setLegendIndex] = useState(0);

    const hasQueryResponseChangeRef = useRef(false);
    const renderStartTimeRef = useRef(0);
    const contextMenuRef = useRef<ChartContextMenuRef>(null);
    const prevQueriesResponseRef = useRef(queriesResponse);

    const mutableQueriesResponse = useMemo(() => {
      if (queriesResponse !== prevQueriesResponseRef.current) {
        hasQueryResponseChangeRef.current = true;
        prevQueriesResponseRef.current = queriesResponse;
        return cloneDeep(queriesResponse);
      }
      return cloneDeep(queriesResponse);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queriesResponse]);

    const handleAddFilter = useCallback(
      (col: string, vals: FilterValue[], merge = true, refresh = true) => {
        addFilter?.(col, vals, merge, refresh);
      },
      [addFilter],
    );

    const handleRenderSuccess = useCallback(() => {
      if (['loading', 'rendered'].indexOf(chartStatus as string) < 0) {
        actions.chartRenderingSucceeded(chartId);
      }
      if (hasQueryResponseChangeRef.current) {
        actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
          slice_id: chartId,
          viz_type: vizType,
          start_offset: renderStartTimeRef.current,
          ts: new Date().getTime(),
          duration: Logger.getTimestamp() - renderStartTimeRef.current,
        });
      }
    }, [actions, chartId, chartStatus, vizType]);

    const handleRenderFailure = useCallback(
      (error: Error, info: { componentStack: string } | null) => {
        logging.warn(error);
        actions.chartRenderingFailed(
          error.toString(),
          chartId,
          info ? info.componentStack : null,
        );
        if (hasQueryResponseChangeRef.current) {
          actions.logEvent(LOG_ACTIONS_RENDER_CHART, {
            slice_id: chartId,
            has_err: true,
            error_details: error.toString(),
            start_offset: renderStartTimeRef.current,
            ts: new Date().getTime(),
            duration: Logger.getTimestamp() - renderStartTimeRef.current,
          });
        }
      },
      [actions, chartId],
    );

    const handleSetControlValue = useCallback(
      (name: string, value: unknown) => {
        setControlValue?.(name, value);
      },
      [setControlValue],
    );

    const handleOnContextMenu = useCallback(
      (offsetX: number, offsetY: number, filters?: ContextMenuFilters) => {
        contextMenuRef.current?.open(offsetX, offsetY, filters);
        setInContextMenu(true);
      },
      [],
    );

    const handleContextMenuSelected = useCallback(() => {
      setInContextMenu(false);
    }, []);

    const handleContextMenuClosed = useCallback(() => {
      setInContextMenu(false);
    }, []);

    const handleLegendStateChanged = useCallback(
      (newLegendState: LegendState) => {
        setLegendState(newLegendState);
      },
      [],
    );

    const handleLegendScroll = useCallback((newLegendIndex: number) => {
      setLegendIndex(newLegendIndex);
    }, []);

    const onContextMenuFallback = useCallback(
      (event: MouseEvent<HTMLDivElement>) => {
        if (!inContextMenu) {
          event.preventDefault();
          handleOnContextMenu(event.clientX, event.clientY);
        }
      },
      [inContextMenu, handleOnContextMenu],
    );

    const hooks: ChartHooks = useMemo(
      () => ({
        onAddFilter: handleAddFilter,
        onContextMenu: showContextMenu ? handleOnContextMenu : undefined,
        onError: handleRenderFailure,
        setControlValue: handleSetControlValue,
        onFilterMenuOpen,
        onFilterMenuClose,
        onLegendStateChanged: handleLegendStateChanged,
        setDataMask: (dataMask: DataMask) => {
          actions?.updateDataMask?.(chartId, dataMask);
        },
        onLegendScroll: handleLegendScroll,
        onChartStateChange,
      }),
      [
        handleAddFilter,
        showContextMenu,
        handleOnContextMenu,
        handleRenderFailure,
        handleSetControlValue,
        onFilterMenuOpen,
        onFilterMenuClose,
        handleLegendStateChanged,
        actions,
        chartId,
        handleLegendScroll,
        onChartStateChange,
      ],
    );

    const hasAnyErrors = queriesResponse?.some(item => item?.error);
    const hasValidPreviousData =
      (queriesResponse?.length ?? 0) > 0 && !hasAnyErrors;

    if (!!chartAlert || chartStatus === null) {
      return null;
    }

    if (chartStatus === 'loading') {
      if (!suppressLoadingSpinner || !hasValidPreviousData) {
        return null;
      }
    }

    renderStartTimeRef.current = Logger.getTimestamp();

    const currentFormData =
      chartIsStale && latestQueryFormData ? latestQueryFormData : formData;
    const currentVizType = currentFormData.viz_type || vizType;

    const snakeCaseVizType = snakeCase(currentVizType);
    const chartClassName =
      currentVizType === VizType.Table
        ? `superset-chart-${snakeCaseVizType}`
        : snakeCaseVizType;

    const webpackHash =
      process.env.WEBPACK_MODE === 'development'
        ? `-${
            // eslint-disable-next-line camelcase
            typeof __webpack_require__ !== 'undefined' &&
            // eslint-disable-next-line camelcase, no-undef
            typeof __webpack_require__.h === 'function' &&
            // eslint-disable-next-line no-undef, camelcase
            __webpack_require__.h()
          }`
        : '';

    let noResultsComponent: ReactNode;
    const noResultTitle = t('No results were returned for this query');
    const noResultDescription =
      source === ChartSource.Explore
        ? t(
            'Make sure that the controls are configured properly and the datasource contains data for the selected time range',
          )
        : undefined;
    const noResultImage = 'chart.svg';
    if (
      (width ?? 0) > BIG_NO_RESULT_MIN_WIDTH &&
      (height ?? 0) > BIG_NO_RESULT_MIN_HEIGHT
    ) {
      noResultsComponent = (
        <EmptyState
          size="large"
          title={noResultTitle}
          description={noResultDescription}
          image={noResultImage}
        />
      );
    } else {
      noResultsComponent = (
        <EmptyState title={noResultTitle} image={noResultImage} size="small" />
      );
    }

    const drillToDetailProps = getChartMetadataRegistry()
      .get(currentVizType)
      ?.behaviors.find(behavior => behavior === Behavior.DrillToDetail)
      ? { inContextMenu }
      : {};

    const hasSearchText = (ownState?.searchText?.length || 0) > 0;
    const hasAgGridFilters =
      ownState?.agGridFilterModel &&
      Object.keys(ownState.agGridFilterModel).length > 0;

    const currentFormDataExtended = currentFormData as JsonObject;
    const bypassNoResult = !(
      currentFormDataExtended?.server_pagination &&
      (hasSearchText || hasAgGridFilters)
    );

    return (
      <>
        {showContextMenu && (
          <ChartContextMenu
            ref={contextMenuRef}
            id={chartId}
            formData={currentFormData as QueryFormData}
            onSelection={handleContextMenuSelected}
            onClose={handleContextMenuClosed}
          />
        )}
        <div
          onContextMenu={
            showContextMenu ? onContextMenuFallback : undefined
          }
        >
          <SuperChart
            disableErrorBoundary
            key={`${chartId}${webpackHash}`}
            id={`chart-id-${chartId}`}
            className={chartClassName}
            chartType={currentVizType}
            width={width}
            height={height}
            annotationData={annotationData}
            datasource={datasource}
            initialValues={initialValues}
            formData={currentFormData}
            ownState={ownState}
            filterState={filterState}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            hooks={hooks as any}
            behaviors={behaviorsList}
            queriesData={mutableQueriesResponse ?? undefined}
            onRenderSuccess={handleRenderSuccess}
            onRenderFailure={handleRenderFailure}
            noResults={noResultsComponent}
            postTransformProps={postTransformProps}
            emitCrossFilters={emitCrossFilters}
            legendState={legendState}
            enableNoResults={bypassNoResult}
            legendIndex={legendIndex}
            isRefreshing={
              Boolean(suppressLoadingSpinner) && chartStatus === 'loading'
            }
            {...drillToDetailProps}
          />
        </div>
      </>
    );
  },
  (prevProps, nextProps) => !shouldUpdate(prevProps, nextProps),
);

export default ChartRenderer;
