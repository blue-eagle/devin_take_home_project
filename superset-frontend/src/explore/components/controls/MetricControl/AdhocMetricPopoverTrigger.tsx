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
import React, { useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { t } from '@apache-superset/core/translation';
import { Metric } from '@superset-ui/core';
import AdhocMetricEditPopoverTitle from 'src/explore/components/controls/MetricControl/AdhocMetricEditPopoverTitle';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import {
  ISaveableDatasource,
  SaveDatasetModal,
} from 'src/SqlLab/components/SaveDatasetModal';
import { Datasource } from 'src/explore/types';
import AdhocMetricEditPopover, {
  SAVED_TAB_KEY,
} from './AdhocMetricEditPopover';
import AdhocMetric from './AdhocMetric';
import { savedMetricType } from './types';
import ControlPopover from '../ControlPopover/ControlPopover';

export type AdhocMetricPopoverTriggerProps = {
  adhocMetric: AdhocMetric;
  onMetricEdit(newMetric: Metric, oldMetric: Metric): void;
  columns: { column_name: string; type: string }[];
  savedMetricsOptions: savedMetricType[];
  savedMetric: savedMetricType | Record<string, never>;
  datasource: Datasource & ISaveableDatasource;
  children: ReactNode;
  isControlledComponent?: boolean;
  visible?: boolean;
  togglePopover?: (visible: boolean) => void;
  closePopover?: () => void;
  isNew?: boolean;
};

const AdhocMetricPopoverTrigger: React.FC<AdhocMetricPopoverTriggerProps> =
  React.memo(
    ({
      adhocMetric,
      onMetricEdit,
      columns,
      savedMetricsOptions,
      savedMetric,
      datasource,
      children,
      isControlledComponent,
      visible: visibleProp,
      togglePopover: togglePopoverProp,
      closePopover: closePopoverProp,
      isNew,
    }) => {
      const [popoverVisible, setPopoverVisible] = useState(false);
      const [title, setTitle] = useState({
        label: adhocMetric.label,
        hasCustomLabel: adhocMetric.hasCustomLabel,
      });
      const [currentLabel, setCurrentLabel] = useState('');
      const [labelModified, setLabelModified] = useState(false);
      const [isTitleEditDisabled, setIsTitleEditDisabled] = useState(false);
      const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);

      const prevOptionNameRef = useRef(adhocMetric.optionName);

      useEffect(() => {
        if (prevOptionNameRef.current !== adhocMetric.optionName) {
          setTitle({
            label: adhocMetric.label,
            hasCustomLabel: adhocMetric.hasCustomLabel,
          });
          setCurrentLabel('');
          setLabelModified(false);
          prevOptionNameRef.current = adhocMetric.optionName;
        }
      }, [adhocMetric]);

      const onLabelChange = useCallback(
        (e: { target: { value: string } }) => {
          const { verbose_name, metric_name } = savedMetric;
          const defaultMetricLabel = adhocMetric?.getDefaultLabel();
          const label = e.target.value;
          setTitle(prev => ({
            label:
              label ||
              currentLabel ||
              verbose_name ||
              metric_name ||
              defaultMetricLabel,
            hasCustomLabel: !!label,
          }));
          setLabelModified(true);
        },
        [savedMetric, adhocMetric, currentLabel],
      );

      const handleDatasetModal = useCallback((showModal: boolean) => {
        setShowSaveDatasetModal(showModal);
      }, []);

      const togglePopoverInternal = useCallback((visible: boolean) => {
        setPopoverVisible(visible);
      }, []);

      const closePopoverInternal = useCallback(() => {
        togglePopoverInternal(false);
        setLabelModified(false);
      }, [togglePopoverInternal]);

      const getCurrentTab = useCallback((tab: string) => {
        setIsTitleEditDisabled(tab === SAVED_TAB_KEY);
      }, []);

      const getCurrentLabel = useCallback(
        ({
          savedMetricLabel,
          adhocMetricLabel,
        }: {
          savedMetricLabel: string;
          adhocMetricLabel: string;
        }) => {
          const label = savedMetricLabel || adhocMetricLabel;
          setCurrentLabel(label);
          setLabelModified(true);
          if (savedMetricLabel || !title.hasCustomLabel) {
            setTitle({
              label,
              hasCustomLabel: false,
            });
          }
        },
        [title.hasCustomLabel],
      );

      const onChange = useCallback(
        (newMetric: Metric, oldMetric: Metric) => {
          onMetricEdit({ ...newMetric, ...title }, oldMetric);
        },
        [onMetricEdit, title],
      );

      const { verbose_name, metric_name } = savedMetric;
      const { hasCustomLabel, label } = adhocMetric;
      const adhocMetricLabel = hasCustomLabel
        ? label
        : adhocMetric.getDefaultLabel();
      const displayTitle = labelModified
        ? title
        : {
            label: verbose_name || metric_name || adhocMetricLabel,
            hasCustomLabel,
          };

      const { visible, togglePopover, closePopover } = isControlledComponent
        ? {
            visible: visibleProp,
            togglePopover: togglePopoverProp ?? togglePopoverInternal,
            closePopover: closePopoverProp ?? closePopoverInternal,
          }
        : {
            visible: popoverVisible,
            togglePopover: togglePopoverInternal,
            closePopover: closePopoverInternal,
          };

      const overlayContent = (
        <ExplorePopoverContent>
          <AdhocMetricEditPopover
            adhocMetric={adhocMetric}
            columns={columns}
            savedMetricsOptions={savedMetricsOptions}
            savedMetric={savedMetric as savedMetricType}
            datasource={
              datasource as unknown as {
                type?: string;
                id?: number | string;
                extra?: string;
              }
            }
            handleDatasetModal={handleDatasetModal}
            onResize={() => {}}
            onClose={closePopover}
            onChange={
              onChange as (newMetric: unknown, oldMetric?: unknown) => void
            }
            getCurrentTab={getCurrentTab}
            getCurrentLabel={getCurrentLabel}
            isNewMetric={isNew}
            isLabelModified={
              labelModified && adhocMetricLabel !== title.label
            }
          />
        </ExplorePopoverContent>
      );

      const popoverTitle = (
        <AdhocMetricEditPopoverTitle
          title={displayTitle}
          onChange={onLabelChange}
          isEditDisabled={isTitleEditDisabled}
        />
      );

      return (
        <>
          {showSaveDatasetModal && (
            <SaveDatasetModal
              visible={showSaveDatasetModal}
              onHide={() => handleDatasetModal(false)}
              buttonTextOnSave={t('Save')}
              buttonTextOnOverwrite={t('Overwrite')}
              modalDescription={t(
                'Save this query as a virtual dataset to continue exploring',
              )}
              datasource={datasource}
            />
          )}
          <ControlPopover
            placement="right"
            trigger="click"
            content={overlayContent}
            defaultOpen={visible}
            open={visible}
            onOpenChange={togglePopover}
            title={popoverTitle}
            destroyOnHidden
          >
            {children}
          </ControlPopover>
        </>
      );
    },
  );

export default AdhocMetricPopoverTrigger;
