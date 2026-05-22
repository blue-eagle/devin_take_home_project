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
import React, { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { nanoid } from 'nanoid';
import { t } from '@apache-superset/core/translation';
import { styled, css, SupersetTheme } from '@apache-superset/core/theme';
import { Icons, Button, InfoTooltip } from '@superset-ui/core/components';
import { FilterValue } from 'react-table';
import Table, {
  type ColumnsType,
  type SortOrder,
  type SorterResult,
  type TablePaginationConfig,
  TableSize,
} from '@superset-ui/core/components/Table';
import Fieldset from '../Fieldset';
import { recurseReactClone } from '../../utils';
import {
  type CRUDCollectionProps,
  type CRUDCollectionState,
  type Sort,
} from '../../types';

const CrudButtonWrapper = styled.div`
  text-align: right;
  ${({ theme }) => `margin-bottom: ${theme.sizeUnit * 2}px`}
`;

const StyledButtonWrapper = styled.span`
  ${({ theme }) => `
    margin-top: ${theme.sizeUnit * 3}px;
    margin-left: ${theme.sizeUnit * 3}px;
    button>span>:first-of-type {
      margin-right: 0;
    }
  `}
`;

type CollectionItem = { id: string | number; [key: string]: unknown };

function createKeyedCollection(arr: Array<object>) {
  const collectionArray = arr.map(
    (o: Record<string, unknown>) =>
      ({
        ...o,
        id: o.id || nanoid(),
      }) as CollectionItem,
  );

  const collection: Record<PropertyKey, CollectionItem> = {};
  collectionArray.forEach((o: CollectionItem) => {
    collection[o.id] = o;
  });

  return {
    collection,
    collectionArray,
  };
}

const CRUDCollection: React.FC<CRUDCollectionProps> = React.memo(
  ({
    collection: collectionProp,
    tableColumns,
    allowAddItem,
    allowDeletes,
    expandFieldset,
    itemGenerator,
    itemRenderers,
    itemCellProps,
    onChange,
    columnLabels,
    columnLabelTooltips,
    sortColumns = [],
    stickyHeader,
    emptyMessage = t('No items'),
    pagination = false,
    filterTerm,
    filterFields,
  }) => {
    const [expandedColumns, setExpandedColumns] = useState<
      Record<string, boolean>
    >({});
    const [collection, setCollection] = useState<
      Record<PropertyKey, CollectionItem>
    >(() => createKeyedCollection(collectionProp).collection);
    const [collectionArray, setCollectionArray] = useState<CollectionItem[]>(
      () => createKeyedCollection(collectionProp).collectionArray,
    );
    const [sortColumn, setSortColumn] = useState('');
    const [sort, setSort] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(() => {
      if (typeof pagination === 'object' && pagination?.pageSize) {
        return pagination.pageSize;
      }
      return 10;
    });

    const prevCollectionProp = useRef(collectionProp);
    useEffect(() => {
      if (collectionProp !== prevCollectionProp.current) {
        const { collection: newColl, collectionArray: newArr } =
          createKeyedCollection(collectionProp);
        setCollection(newColl);
        setCollectionArray(newArr);
        prevCollectionProp.current = collectionProp;
      }
    }, [collectionProp]);

    const onCellChange = useCallback(
      (id: string | number, col: string, val: unknown) => {
        setCollection(prevColl => {
          const updatedCollection = {
            ...prevColl,
            [id]: {
              ...prevColl[id],
              [col]: val,
            },
          };
          return updatedCollection;
        });
        setCollectionArray(prevArr => {
          const updatedArr = prevArr.map(item =>
            item.id === id ? { ...item, [col]: val } : item,
          );
          onChange?.(updatedArr);
          return updatedArr;
        });
      },
      [onChange],
    );

    const changeCollection = useCallback(
      (
        newColl: Record<PropertyKey, CollectionItem>,
        currentCollectionArray: CollectionItem[],
      ) => {
        const existingIds = new Set(currentCollectionArray.map(item => item.id));
        const newCollectionArray: CollectionItem[] = [];

        for (const existingItem of currentCollectionArray) {
          if (newColl[existingItem.id]) {
            newCollectionArray.push(newColl[existingItem.id]);
          }
        }

        for (const item of Object.values(newColl) as CollectionItem[]) {
          if (!existingIds.has(item.id)) {
            newCollectionArray.push(item);
          }
        }

        setCollection(newColl);
        setCollectionArray(newCollectionArray);
        onChange?.(newCollectionArray);
      },
      [onChange],
    );

    const deleteItem = useCallback(
      (id: string | number) => {
        setCollectionArray(prevArr => {
          setCollection(prevColl => {
            const newColl = { ...prevColl };
            delete newColl[id];
            return newColl;
          });
          const newArr = prevArr.filter(item => item.id !== id);
          onChange?.(newArr);
          return newArr;
        });
      },
      [onChange],
    );

    const onFieldsetChange = useCallback(
      (item: CollectionItem) => {
        setCollection(prevColl => {
          const newColl = { ...prevColl, [item.id]: item };
          setCollectionArray(prevArr => {
            const existingIds = new Set(prevArr.map(i => i.id));
            const newArr: CollectionItem[] = [];
            for (const existing of prevArr) {
              if (newColl[existing.id]) {
                newArr.push(newColl[existing.id]);
              }
            }
            for (const val of Object.values(newColl) as CollectionItem[]) {
              if (!existingIds.has(val.id)) {
                newArr.push(val);
              }
            }
            onChange?.(newArr);
            return newArr;
          });
          return newColl;
        });
      },
      [onChange],
    );

    const onAddItem = useCallback(() => {
      if (itemGenerator) {
        let newItem = itemGenerator();
        const shouldStartExpanded = newItem.expanded === true;
        if (!newItem.id) {
          newItem = { ...newItem, id: nanoid() };
        }
        delete newItem.expanded;

        setCollection(prevColl => ({
          ...prevColl,
          [newItem.id]: newItem,
        }));
        setCollectionArray(prevArr => {
          const newArr = [newItem, ...prevArr];
          onChange?.(newArr);
          return newArr;
        });
        if (shouldStartExpanded) {
          setExpandedColumns(prev => ({
            ...prev,
            [newItem.id]: true,
          }));
        }
      }
    }, [itemGenerator, onChange]);

    const toggleExpand = useCallback((id: string | number) => {
      setExpandedColumns(prev => ({
        ...prev,
        [id]: !prev[id],
      }));
    }, []);

    const getLabel = useCallback(
      (col: string): string => {
        let label = columnLabels?.[col] ? columnLabels[col] : col;
        if (label.startsWith('__')) {
          label = '';
        }
        return label;
      },
      [columnLabels],
    );

    const getTooltip = useCallback(
      (col: string): string | undefined => columnLabelTooltips?.[col],
      [columnLabelTooltips],
    );

    const handleTableChange = useCallback(
      (
        paginationInfo: TablePaginationConfig,
        _filters: Record<string, FilterValue | null>,
        sorter: SorterResult<CollectionItem> | SorterResult<CollectionItem>[],
      ) => {
        if (
          paginationInfo.current !== undefined &&
          paginationInfo.pageSize !== undefined
        ) {
          setCurrentPage(paginationInfo.current);
          setPageSize(paginationInfo.pageSize);
        }

        const columnSorter = Array.isArray(sorter) ? sorter[0] : sorter;
        let newSortColumn = '';
        let newSortOrder = 0;

        if (columnSorter?.columnKey && columnSorter?.order) {
          newSortColumn = columnSorter.columnKey as string;
          newSortOrder = columnSorter.order === 'ascend' ? 1 : 2;
        }

        const col = newSortColumn;

        if (sortColumns.includes(col) || newSortOrder === 0) {
          let sortedArray = [...collectionProp];

          if (newSortOrder !== 0) {
            const compareSort = (m: Sort, n: Sort) => {
              if (typeof m === 'string' && typeof n === 'string') {
                return (m || '').localeCompare(n || '');
              }
              if (typeof m === 'number' && typeof n === 'number') {
                return m - n;
              }
              if (typeof m === 'boolean' && typeof n === 'boolean') {
                return m === n ? 0 : m ? 1 : -1;
              }
              const mStr = String(m ?? '');
              const nStr = String(n ?? '');
              return mStr.localeCompare(nStr);
            };

            sortedArray.sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
              compareSort(a[col] as Sort, b[col] as Sort),
            );
            if (newSortOrder === 2) {
              sortedArray.reverse();
            }
          } else {
            const { collectionArray: resetArr } =
              createKeyedCollection(collectionProp);
            sortedArray = resetArr;
          }

          setCollectionArray(sortedArray as CollectionItem[]);
          setSortColumn(newSortColumn);
          setSort(newSortOrder);
        }
      },
      [sortColumns, collectionProp],
    );

    const renderExpandableSection = useCallback(
      (item: CollectionItem): ReactNode => {
        const propsGenerator = () => ({ item, onChange: onFieldsetChange });
        return recurseReactClone(expandFieldset, Fieldset, propsGenerator);
      },
      [expandFieldset, onFieldsetChange],
    );

    const renderCell = useCallback(
      (record: CollectionItem, col: string): ReactNode => {
        const renderer = itemRenderers?.[col];
        const val = record[col];
        const onCellChangeForCol = (newVal: unknown) =>
          onCellChange(record.id, col, newVal);
        return renderer
          ? renderer(val, onCellChangeForCol, getLabel(col), record)
          : (val as ReactNode);
      },
      [itemRenderers, onCellChange, getLabel],
    );

    const buildTableColumns = useCallback(() => {
      const antdColumns: ColumnsType = tableColumns.map(col => {
        const label = getLabel(col);
        const tooltip = getTooltip(col);
        const isSortable = sortColumns.includes(col);
        const currentSortOrder: SortOrder | null | undefined =
          sortColumn === col
            ? sort === 1
              ? 'ascend'
              : sort === 2
                ? 'descend'
                : null
            : null;

        return {
          key: col,
          dataIndex: col,
          minWidth: 100,
          title: (
            <>
              {label}
              {tooltip && (
                <>
                  {' '}
                  <InfoTooltip
                    label={t('description')}
                    tooltip={tooltip}
                    placement="top"
                  />
                </>
              )}
            </>
          ),
          render: (text: unknown, record: CollectionItem) =>
            renderCell(record, col),
          onCell: (record: CollectionItem) => {
            const cellPropsFn = itemCellProps?.[col];
            const val = record[col];
            return cellPropsFn ? cellPropsFn(val, label, record) : {};
          },
          sorter: isSortable,
          sortOrder: currentSortOrder,
        };
      });

      if (allowDeletes) {
        antdColumns.push({
          key: '__actions',
          dataIndex: '__actions',
          sorter: false,
          title: <></>,
          onCell: () => ({}),
          sortOrder: null,
          minWidth: 50,
          render: (_, record: CollectionItem) => (
            <span
              data-test="crud-delete-option"
              className="text-primary"
              css={(theme: SupersetTheme) => css`
                display: flex;
                justify-content: center;
                color: ${theme.colorTextTertiary};
              `}
            >
              <Icons.DeleteOutlined
                aria-label={t('Delete item')}
                className="pointer"
                data-test="crud-delete-icon"
                role="button"
                tabIndex={0}
                onClick={() => deleteItem(record.id)}
                iconSize="l"
                iconColor="inherit"
              />
            </span>
          ),
        });
      }

      return antdColumns as ColumnsType<CollectionItem>;
    }, [
      tableColumns,
      getLabel,
      getTooltip,
      sortColumns,
      sortColumn,
      sort,
      renderCell,
      itemCellProps,
      allowDeletes,
      deleteItem,
    ]);

    const displayData =
      filterTerm && filterFields?.length
        ? collectionArray.filter(item =>
            filterFields.some(field =>
              String(item[field] ?? '')
                .toLowerCase()
                .includes(filterTerm.toLowerCase()),
            ),
          )
        : collectionArray;

    const builtColumns = buildTableColumns();
    const expandedRowKeys = Object.keys(expandedColumns).filter(
      id => expandedColumns[id],
    );

    const expandableConfig = expandFieldset
      ? {
          expandedRowRender: (record: CollectionItem) =>
            renderExpandableSection(record),
          rowExpandable: () => true,
          expandedRowKeys,
          onExpand: (expanded: boolean, record: CollectionItem) => {
            toggleExpand(record.id);
          },
        }
      : undefined;

    const totalItems = displayData.length;
    const maxPage = totalItems > 0 ? Math.ceil(totalItems / pageSize) : 1;
    const clampedPage = Math.min(currentPage, maxPage);
    const paginationConfig: false | TablePaginationConfig | undefined =
      pagination === false || pagination === undefined
        ? pagination
        : {
            ...(typeof pagination === 'object' ? pagination : {}),
            current: clampedPage,
            pageSize,
            total: totalItems,
          };

    return (
      <>
        <CrudButtonWrapper>
          {allowAddItem && (
            <StyledButtonWrapper>
              <Button
                buttonSize="small"
                buttonStyle="secondary"
                onClick={onAddItem}
                data-test="add-item-button"
              >
                <Icons.PlusOutlined
                  iconSize="m"
                  data-test="crud-add-table-item"
                />
                {t('Add item')}
              </Button>
            </StyledButtonWrapper>
          )}
        </CrudButtonWrapper>
        <Table<CollectionItem>
          data-test="crud-table"
          columns={builtColumns}
          data={displayData as CollectionItem[]}
          rowKey={(record: CollectionItem) => String(record.id)}
          sticky={stickyHeader}
          pagination={paginationConfig}
          onChange={handleTableChange}
          locale={{ emptyText: emptyMessage }}
          css={
            stickyHeader &&
            css`
              overflow: auto;
            `
          }
          expandable={expandableConfig}
          size={TableSize.Middle}
          tableLayout="auto"
        />
      </>
    );
  },
);

export default CRUDCollection;
