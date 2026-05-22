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
import { ReactNode, CSSProperties, useState, useCallback, useEffect, useRef } from 'react';
import cx from 'classnames';
import { addAlpha } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/theme';

type ShouldFocusContainer = HTMLDivElement & {
  contains: (event_target: EventTarget & HTMLElement) => boolean;
};

interface WithPopoverMenuProps {
  children: ReactNode;
  disableClick: boolean;
  menuItems: ReactNode[];
  onChangeFocus: (focus: boolean) => void;
  isFocused: boolean;
  shouldFocus: (
    event: any,
    container: ShouldFocusContainer,
    menuRef: HTMLDivElement | null,
  ) => boolean;
  editMode: boolean;
  style: CSSProperties;
}

const defaultShouldFocus = (
  event: any,
  container: ShouldFocusContainer,
  menuRef: HTMLDivElement | null,
) => {
  if (container?.contains(event.target)) return true;
  if (menuRef?.contains(event.target)) return true;
  return false;
};

const WithPopoverMenuStyles = styled.div`
  ${({ theme }) => css`
    position: relative;
    outline: none;

    &.with-popover-menu--focused:after {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: 2px solid ${theme.colorPrimary};
      pointer-events: none;
    }

    .dashboard-component-tabs li &.with-popover-menu--focused:after {
      top: ${theme.sizeUnit * -3}px;
      left: ${theme.sizeUnit * -2}px;
      width: calc(100% + ${theme.sizeUnit * 4}px);
      height: calc(100% + ${theme.sizeUnit * 7}px);
    }
  `}
`;

const PopoverMenuStyles = styled.div`
  ${({ theme }) => css`
    position: absolute;
    flex-wrap: nowrap;
    left: 1px;
    top: -42px;
    height: ${theme.sizeUnit * 10}px;
    padding: 0 ${theme.sizeUnit * 4}px;
    background: ${theme.colorBgContainer};
    box-shadow: 0 1px 2px 1px ${addAlpha(theme.colorTextBase, 0.35)};
    font-size: ${theme.fontSize}px;
    cursor: default;
    z-index: 3000;

    &,
    .menu-item {
      display: flex;
      flex-direction: row;
      align-items: center;
    }

    /* vertical spacer after each menu item */
    .menu-item:not(:last-child):after {
      content: '';
      width: 1px;
      height: 100%;
      background: ${theme.colorSplit};
      margin: 0 ${theme.sizeUnit * 4}px;
    }
  `}
`;

export default function WithPopoverMenu({
  children = null,
  disableClick = false,
  menuItems = [],
  onChangeFocus = null as unknown as (focus: boolean) => void,
  isFocused: isFocusedProp = false,
  shouldFocus: shouldFocusFunc = defaultShouldFocus,
  editMode,
  style = null as unknown as CSSProperties,
}: WithPopoverMenuProps) {
  const [isFocused, setIsFocused] = useState(isFocusedProp);
  const containerRef = useRef<ShouldFocusContainer>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusEventRef = useRef<Event | null>(null);

  const handleClick = useCallback(
    (event: any) => {
      if (!editMode) {
        return;
      }

      const nativeEvent = event.nativeEvent || event;
      if (focusEventRef.current === nativeEvent) {
        focusEventRef.current = null;
        return;
      }

      const shouldFocus = shouldFocusFunc(event, containerRef.current!, menuRef.current);

      if (!disableClick && shouldFocus && !isFocused) {
        focusEventRef.current = event.nativeEvent || event;
        setIsFocused(true);
        onChangeFocus?.(true);
      } else if (!shouldFocus && isFocused) {
        setIsFocused(false);
        onChangeFocus?.(false);
      }
    },
    [editMode, disableClick, isFocused, shouldFocusFunc, onChangeFocus],
  );

  const handleClickRef = useRef(handleClick);
  handleClickRef.current = handleClick;

  useEffect(() => {
    if (editMode && isFocusedProp && !isFocused) {
      const handler = (e: Event) => handleClickRef.current(e);
      document.addEventListener('click', handler);
      document.addEventListener('drag', handler);
      setIsFocused(true);
      return () => {
        document.removeEventListener('click', handler);
        document.removeEventListener('drag', handler);
      };
    }
    if (isFocused && !editMode) {
      setIsFocused(false);
    }
    return undefined;
  }, [editMode, isFocusedProp]);

  useEffect(() => {
    if (isFocused) {
      const handler = (e: Event) => handleClickRef.current(e);
      document.addEventListener('click', handler);
      document.addEventListener('drag', handler);
      return () => {
        document.removeEventListener('click', handler);
        document.removeEventListener('drag', handler);
      };
    }
    return undefined;
  }, [isFocused]);

  return (
    <WithPopoverMenuStyles
      ref={containerRef as any}
      onClick={handleClick}
      role="none"
      className={cx(
        'with-popover-menu',
        editMode && isFocused && 'with-popover-menu--focused',
      )}
      style={style}
    >
      {children}
      {editMode && isFocused && (menuItems?.length ?? 0) > 0 && (
        <PopoverMenuStyles ref={menuRef}>
          {menuItems.map((node: ReactNode, i: number) => (
            <div className="menu-item" key={`menu-item-${i}`}>
              {node}
            </div>
          ))}
        </PopoverMenuStyles>
      )}
    </WithPopoverMenuStyles>
  );
}
