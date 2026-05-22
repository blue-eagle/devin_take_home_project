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

function AdhocMetricPopoverTrigger({
  adhocMetric: adhocMetricProp,
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
}: AdhocMetricPopoverTriggerProps) {
  const [popoverVisible, setPopoverVisible] = useState(false);
  const [title, setTitle] = useState({
    label: adhocMetricProp.label,
    hasCustomLabel: adhocMetricProp.hasCustomLabel,
  });
  const [currentLabel, setCurrentLabel] = useState('');
  const [labelModified, setLabelModified] = useState(false);
  const [isTitleEditDisabled, setIsTitleEditDisabled] = useState(false);
  const [showSaveDatasetModal, setShowSaveDatasetModal] = useState(false);
  const prevOptionName = useRef(adhocMetricProp.optionName);

  useEffect(() => {
    if (prevOptionName.current !== adhocMetricProp.optionName) {
      setTitle({
        label: adhocMetricProp.label,
        hasCustomLabel: adhocMetricProp.hasCustomLabel,
      });
      setCurrentLabel('');
      setLabelModified(false);
      prevOptionName.current = adhocMetricProp.optionName;
    }
  }, [adhocMetricProp.optionName, adhocMetricProp.label, adhocMetricProp.hasCustomLabel]);

  const onLabelChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { verbose_name, metric_name } = savedMetric;
      const defaultMetricLabel = adhocMetricProp?.getDefaultLabel();
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
    [savedMetric, adhocMetricProp, currentLabel],
  );

  const onPopoverResize = useCallback(() => {
    // Force update not needed in functional components
  }, []);

  const handleDatasetModal = useCallback((showModal: boolean) => {
    setShowSaveDatasetModal(showModal);
  }, []);

  const internalClosePopover = useCallback(() => {
    setPopoverVisible(false);
    setLabelModified(false);
  }, []);

  const internalTogglePopover = useCallback((visible: boolean) => {
    setPopoverVisible(visible);
  }, []);

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

  const handleChange = useCallback(
    (newMetric: Metric, oldMetric: Metric) => {
      onMetricEdit({ ...newMetric, ...title }, oldMetric);
    },
    [onMetricEdit, title],
  );

  const { verbose_name, metric_name } = savedMetric;
  const { hasCustomLabel, label } = adhocMetricProp;
  const adhocMetricLabel = hasCustomLabel
    ? label
    : adhocMetricProp.getDefaultLabel();
  const displayTitle = labelModified
    ? title
    : {
        label: verbose_name || metric_name || adhocMetricLabel,
        hasCustomLabel,
      };

  const { visible, togglePopover, closePopover } = isControlledComponent
    ? {
        visible: visibleProp,
        togglePopover: togglePopoverProp ?? internalTogglePopover,
        closePopover: closePopoverProp ?? internalClosePopover,
      }
    : {
        visible: popoverVisible,
        togglePopover: internalTogglePopover,
        closePopover: internalClosePopover,
      };

  const overlayContent = (
    <ExplorePopoverContent>
      <AdhocMetricEditPopover
        adhocMetric={adhocMetricProp}
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
        onResize={onPopoverResize}
        onClose={closePopover}
        onChange={
          handleChange as (newMetric: unknown, oldMetric?: unknown) => void
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
}

export default AdhocMetricPopoverTrigger;
