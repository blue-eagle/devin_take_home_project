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
import React, { useState, useCallback, type ReactNode } from 'react';
import { OptionSortType } from 'src/explore/types';
import AdhocFilterEditPopover from 'src/explore/components/controls/FilterControl/AdhocFilterEditPopover';
import AdhocFilter from 'src/explore/components/controls/FilterControl/AdhocFilter';
import { ExplorePopoverContent } from 'src/explore/components/ExploreContentPopover';
import { Operators } from 'src/explore/constants';
import ControlPopover from '../../ControlPopover/ControlPopover';

interface AdhocFilterPopoverTriggerProps {
  sections?: string[];
  operators?: Operators[];
  adhocFilter: AdhocFilter;
  options: OptionSortType[];
  datasource: Record<string, unknown>;
  onFilterEdit: (editedFilter: AdhocFilter) => void;
  partitionColumn?: string;
  isControlledComponent?: boolean;
  visible?: boolean;
  togglePopover?: (visible: boolean) => void;
  closePopover?: () => void;
  requireSave?: boolean;
  children?: ReactNode;
}

const AdhocFilterPopoverTrigger: React.FC<AdhocFilterPopoverTriggerProps> =
  React.memo(
    ({
      sections,
      operators,
      adhocFilter,
      options,
      datasource,
      onFilterEdit,
      partitionColumn,
      isControlledComponent,
      visible: visibleProp,
      togglePopover: togglePopoverProp,
      closePopover: closePopoverProp,
      requireSave,
      children,
    }) => {
      const [popoverVisible, setPopoverVisible] = useState(false);

      const togglePopoverInternal = useCallback((visible: boolean) => {
        setPopoverVisible(visible);
      }, []);

      const closePopoverInternal = useCallback(() => {
        togglePopoverInternal(false);
      }, [togglePopoverInternal]);

      const { visible, togglePopover, closePopover } = isControlledComponent
        ? {
            visible: visibleProp,
            togglePopover: togglePopoverProp,
            closePopover: closePopoverProp,
          }
        : {
            visible: popoverVisible,
            togglePopover: togglePopoverInternal,
            closePopover: closePopoverInternal,
          };

      const overlayContent = (
        <ExplorePopoverContent>
          <AdhocFilterEditPopover
            adhocFilter={adhocFilter}
            options={options}
            datasource={datasource}
            partitionColumn={partitionColumn}
            onResize={() => {}}
            onClose={closePopover ?? (() => {})}
            sections={sections}
            operators={operators}
            onChange={onFilterEdit}
            requireSave={requireSave}
          />
        </ExplorePopoverContent>
      );

      return (
        <ControlPopover
          trigger="click"
          content={overlayContent}
          defaultOpen={visible}
          open={visible}
          onOpenChange={togglePopover}
          destroyOnHidden
        >
          {children}
        </ControlPopover>
      );
    },
  );

export default AdhocFilterPopoverTrigger;
