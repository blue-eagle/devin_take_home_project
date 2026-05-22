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
import {
  ReactNode,
  CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import cx from 'classnames';
import { addAlpha } from '@superset-ui/core';
import { css, styled } from '@apache-superset/core/theme';

type ShouldFocusContainer = HTMLDivElement & {
  contains: (event_target: EventTarget & HTMLElement) => boolean;
};

interface WithPopoverMenuProps {
  children: ReactNode;
  disableClick?: boolean;
  menuItems?: ReactNode[];
  onChangeFocus?: ((focus: boolean) => void) | null;
  isFocused?: boolean;
  shouldFocus?: (
    event: any,
    container: ShouldFocusContainer,
    menuRef: HTMLDivElement | null,
  ) => boolean;
  editMode?: boolean;
  style?: CSSProperties | null;
}

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

const defaultShouldFocus = (
  event: any,
  container: ShouldFocusContainer,
  menuRef: HTMLDivElement | null,
) => {
  if (container?.contains(event.target)) return true;
  if (menuRef?.contains(event.target)) return true;
  return false;
};

export default function WithPopoverMenu({
  children,
  disableClick = false,
  menuItems = [],
  onChangeFocus = null,
  isFocused: isFocusedProp = false,
  shouldFocus: shouldFocusFunc = defaultShouldFocus,
  editMode = false,
  style = null,
}: WithPopoverMenuProps) {
  const [isFocused, setIsFocused] = useState(isFocusedProp);
  const containerRef = useRef<ShouldFocusContainer | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
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

      const shouldFocus = shouldFocusFunc(
        event,
        containerRef.current!,
        menuRef.current,
      );

      if (shouldFocus === isFocused) return;

      if (!disableClick && shouldFocus && !isFocused) {
        focusEventRef.current = event.nativeEvent || event;
        setIsFocused(true);
        if (onChangeFocus) onChangeFocus(true);
      } else if (!shouldFocus && isFocused) {
        setIsFocused(false);
        if (onChangeFocus) onChangeFocus(false);
      }
    },
    [editMode, shouldFocusFunc, isFocused, disableClick, onChangeFocus],
  );

  useEffect(() => {
    if (editMode && isFocusedProp && !isFocused) {
      setIsFocused(true);
    } else if (isFocused && !editMode) {
      setIsFocused(false);
    }
  }, [editMode, isFocusedProp]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isFocused && editMode) {
      document.addEventListener('click', handleClick);
      document.addEventListener('drag', handleClick);
      return () => {
        document.removeEventListener('click', handleClick);
        document.removeEventListener('drag', handleClick);
      };
    }
    return undefined;
  }, [isFocused, editMode, handleClick]);

  return (
    <WithPopoverMenuStyles
      ref={containerRef as React.Ref<HTMLDivElement>}
      onClick={handleClick}
      role="none"
      className={cx(
        'with-popover-menu',
        editMode && isFocused && 'with-popover-menu--focused',
      )}
      style={style ?? undefined}
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
