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
import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { t } from '@apache-superset/core/translation';
import { JsonObject } from '@superset-ui/core';

import { Loading } from '@superset-ui/core/components';
import { PluginContext } from 'src/components';
import type { PluginContextType } from 'src/components/DynamicPlugins/types';
import getBootstrapData from 'src/utils/getBootstrapData';
import type { Slice } from 'src/dashboard/types';
import getChartIdsFromLayout from '../util/getChartIdsFromLayout';
import getLayoutComponentFromChartId from '../util/getLayoutComponentFromChartId';

import {
  LOG_ACTIONS_HIDE_BROWSER_TAB,
  LOG_ACTIONS_MOUNT_DASHBOARD,
  Logger,
} from '../../logger/LogUtils';
import { areObjectsEqual } from '../../reduxUtils';

import getLocationHash from '../util/getLocationHash';
import isDashboardEmpty from '../util/isDashboardEmpty';
import type {
  AppliedCrossFilterType,
  AppliedNativeFilterType,
  Filter,
} from '@superset-ui/core';
import { getAffectedOwnDataCharts } from '../util/charts/getOwnDataCharts';
import { getRelatedCharts } from '../util/getRelatedCharts';
import type {
  ActiveFilters,
  ChartConfiguration,
  DashboardLayout,
  DatasourcesState,
  LayoutItem,
} from '../types';

type RelatedChartsFilter =
  | AppliedNativeFilterType
  | AppliedCrossFilterType
  | Filter;

interface DashboardActions {
  addSliceToDashboard: (id: number, component: LayoutItem | undefined) => void;
  removeSliceFromDashboard: (id: number) => void;
  triggerQuery: (value: boolean, id: number | string) => void;
  logEvent: (eventName: string, eventData: Record<string, unknown>) => void;
  clearDataMaskState: () => void;
  clearAllChartStates: () => void;
  setDatasources: (datasources: unknown) => void;
}

export interface DashboardProps {
  actions: DashboardActions;
  dashboardId: number;
  editMode?: boolean;
  isPublished?: boolean;
  hasUnsavedChanges?: boolean;
  slices: Record<string, Slice>;
  activeFilters: ActiveFilters;
  chartConfiguration?: ChartConfiguration;
  datasources: DatasourcesState;
  ownDataCharts: JsonObject;
  layout: DashboardLayout;
  impressionId: string;
  timeout?: number;
  userId?: string;
  children?: ReactNode;
}

function onBeforeUnload(hasChanged: boolean): void {
  if (hasChanged) {
    window.addEventListener('beforeunload', unload);
  } else {
    window.removeEventListener('beforeunload', unload);
  }
}

function unload(): string {
  const message = t('You have unsaved changes.');
  (window.event as BeforeUnloadEvent).returnValue = message;
  return message;
}

const Dashboard: React.FC<DashboardProps> = React.memo(
  ({
    actions,
    dashboardId,
    editMode,
    isPublished,
    hasUnsavedChanges,
    slices,
    activeFilters,
    chartConfiguration,
    datasources,
    ownDataCharts,
    layout,
    impressionId,
    timeout = 60,
    userId = '',
    children,
  }) => {
    const context = useContext(PluginContext) as PluginContextType;
    const appliedFiltersRef = useRef<ActiveFilters>(activeFilters ?? {});
    const appliedOwnDataChartsRef = useRef<JsonObject>(ownDataCharts ?? {});
    const visibilityEventDataRef = useRef({ start_offset: 0, ts: 0 });
    const prevLayoutRef = useRef(layout);
    const prevDashboardIdRef = useRef(dashboardId);

    const refreshCharts = useCallback(
      (ids: (string | number)[]) => {
        ids.forEach(id => {
          actions.triggerQuery(true, id);
        });
      },
      [actions],
    );

    const applyFilters = useCallback(() => {
      const appliedFilters = appliedFiltersRef.current;
      const currFilterKeys = Object.keys(activeFilters);
      const appliedFilterKeys = Object.keys(appliedFilters);
      const allKeys = new Set(currFilterKeys.concat(appliedFilterKeys));
      const affectedChartIds: (string | number)[] = getAffectedOwnDataCharts(
        ownDataCharts,
        appliedOwnDataChartsRef.current,
      );

      [...allKeys].forEach(filterKey => {
        if (
          !currFilterKeys.includes(filterKey) &&
          appliedFilterKeys.includes(filterKey)
        ) {
          affectedChartIds.push(
            ...getRelatedCharts(
              filterKey,
              appliedFilters[filterKey] as unknown as RelatedChartsFilter,
              slices,
            ),
          );
        } else if (!appliedFilterKeys.includes(filterKey)) {
          affectedChartIds.push(
            ...getRelatedCharts(
              filterKey,
              activeFilters[filterKey] as unknown as RelatedChartsFilter,
              slices,
            ),
          );
        } else {
          if (
            !areObjectsEqual(
              appliedFilters[filterKey].values,
              activeFilters[filterKey].values,
              { ignoreUndefined: true },
            )
          ) {
            affectedChartIds.push(
              ...getRelatedCharts(
                filterKey,
                activeFilters[filterKey] as unknown as RelatedChartsFilter,
                slices,
              ),
            );
          }
          if (
            !areObjectsEqual(
              appliedFilters[filterKey].scope,
              activeFilters[filterKey].scope,
            )
          ) {
            const chartsInScope = (
              activeFilters[filterKey].scope || []
            ).concat(appliedFilters[filterKey].scope || []);
            affectedChartIds.push(...chartsInScope);
          }
        }
      });

      refreshCharts([...new Set(affectedChartIds)]);
      appliedFiltersRef.current = activeFilters;
      appliedOwnDataChartsRef.current = ownDataCharts;
    }, [activeFilters, ownDataCharts, slices, refreshCharts]);

    const applyCharts = useCallback(() => {
      if (!chartConfiguration) {
        return;
      }
      if (
        !editMode &&
        (!areObjectsEqual(
          appliedOwnDataChartsRef.current,
          ownDataCharts,
          { ignoreUndefined: true },
        ) ||
          !areObjectsEqual(appliedFiltersRef.current, activeFilters, {
            ignoreUndefined: true,
          }))
      ) {
        applyFilters();
      }
      if (hasUnsavedChanges) {
        onBeforeUnload(true);
      } else {
        onBeforeUnload(false);
      }
    }, [
      chartConfiguration,
      editMode,
      ownDataCharts,
      activeFilters,
      hasUnsavedChanges,
      applyFilters,
    ]);

    const onVisibilityChange = useCallback(() => {
      if (document.visibilityState === 'hidden') {
        visibilityEventDataRef.current = {
          start_offset: Logger.getTimestamp(),
          ts: new Date().getTime(),
        };
      } else if (document.visibilityState === 'visible') {
        const logStart = visibilityEventDataRef.current.start_offset;
        actions.logEvent(LOG_ACTIONS_HIDE_BROWSER_TAB, {
          ...visibilityEventDataRef.current,
          duration: Logger.getTimestamp() - logStart,
        });
      }
    }, [actions]);

    // componentDidMount
    useEffect(() => {
      const bootstrapData = getBootstrapData();
      const eventData: Record<string, unknown> = {
        is_soft_navigation: Logger.timeOriginOffset > 0,
        is_edit_mode: editMode,
        mount_duration: Logger.getTimestamp(),
        is_empty: isDashboardEmpty(layout),
        is_published: isPublished,
        bootstrap_data_length: JSON.stringify(bootstrapData).length,
      };
      const directLinkComponentId = getLocationHash();
      if (directLinkComponentId) {
        eventData.target_id = directLinkComponentId;
      }
      actions.logEvent(LOG_ACTIONS_MOUNT_DASHBOARD, eventData);

      if (document.visibilityState === 'hidden') {
        visibilityEventDataRef.current = {
          start_offset: Logger.getTimestamp(),
          ts: new Date().getTime(),
        };
      }
      window.addEventListener('visibilitychange', onVisibilityChange);

      applyCharts();

      return () => {
        window.removeEventListener('visibilitychange', onVisibilityChange);
        actions.clearDataMaskState();
        actions.clearAllChartStates();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // componentDidUpdate - handle layout changes
    useEffect(() => {
      applyCharts();

      const currentChartIds = getChartIdsFromLayout(prevLayoutRef.current);
      const nextChartIds = getChartIdsFromLayout(layout);

      if (prevDashboardIdRef.current !== dashboardId) {
        prevDashboardIdRef.current = dashboardId;
        prevLayoutRef.current = layout;
        return;
      }

      if (currentChartIds.length < nextChartIds.length) {
        const newChartIds = nextChartIds.filter(
          key => currentChartIds.indexOf(key) === -1,
        );
        newChartIds.forEach(newChartId =>
          actions.addSliceToDashboard(
            newChartId,
            getLayoutComponentFromChartId(layout, newChartId),
          ),
        );
      } else if (currentChartIds.length > nextChartIds.length) {
        const removedChartIds = currentChartIds.filter(
          key => nextChartIds.indexOf(key) === -1,
        );
        removedChartIds.forEach(removedChartId =>
          actions.removeSliceFromDashboard(removedChartId),
        );
      }

      prevLayoutRef.current = layout;
      prevDashboardIdRef.current = dashboardId;
    });

    if (context.loading) {
      return <Loading />;
    }
    return <>{children}</>;
  },
);

export default Dashboard;
