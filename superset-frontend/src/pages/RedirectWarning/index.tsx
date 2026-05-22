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

import { useState, useMemo, useCallback, useEffect } from 'react';
import { t } from '@apache-superset/core/translation';
import { css, useTheme } from '@apache-superset/core/theme';
import {
  Button,
  Card,
  Checkbox,
  Flex,
  Typography,
} from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import { getTargetUrl, isUrlTrusted, trustUrl, isAllowedScheme } from './utils';

export default function RedirectWarning() {
  const theme = useTheme();
  const [trustChecked, setTrustChecked] = useState(false);

  const targetUrl = useMemo(() => getTargetUrl(), []);

  // Redirect immediately if the URL is already trusted
  useEffect(() => {
    if (targetUrl && isAllowedScheme(targetUrl) && isUrlTrusted(targetUrl)) {
      window.location.href = targetUrl;
    }
  }, [targetUrl]);

  const handleContinue = useCallback(() => {
    if (!targetUrl || !isAllowedScheme(targetUrl)) return;
    if (trustChecked) {
      trustUrl(targetUrl);
    }
    window.location.href = targetUrl;
  }, [trustChecked, targetUrl]);

  const handleReturn = useCallback(() => {
    window.location.href = '/';
  }, []);

  if (!targetUrl) {
    return (
      <Flex
        justify="center"
        align="center"
        css={css`
          height: calc(100vh - 64px);
          background-color: ${theme.colorBgLayout};
          padding: ${theme.padding}px;
        `}
      >
        <Card>
          <div
            css={css`
              padding: ${theme.paddingXL}px;
            `}
          >
            <Typography.Text type="danger">
              {t('Missing URL parameter')}
            </Typography.Text>
          </div>
        </Card>
      </Flex>
    );
  }

  return (
    <Flex
      justify="center"
      align="center"
      css={css`
        height: calc(100vh - 64px);
        background-color: ${theme.colorBgLayout};
        padding: ${theme.padding}px;
      `}
    >
      <Card
        css={css`
          max-width: 520px;
          width: 100%;
          box-shadow: ${theme.boxShadowSecondary};
        `}
      >
        <Flex
          align="center"
          gap="middle"
          css={css`
            padding: ${theme.paddingLG}px ${theme.paddingXL}px;
            border-bottom: 1px solid ${theme.colorBorderSecondary};
          `}
        >
          <Icons.WarningOutlined iconColor={theme.colorWarning} iconSize="xl" />
          <Typography.Title
            level={4}
            css={css`
              && {
                margin: 0;
              }
            `}
          >
            {t('External link warning')}
          </Typography.Title>
        </Flex>

        <div
          css={css`
            padding: ${theme.paddingXL}px;
          `}
        >
          <Typography.Paragraph type="secondary">
            {t(
              'This link will take you to an external website. We cannot guarantee the safety of external destinations.',
            )}
          </Typography.Paragraph>

          <Flex
            align="center"
            gap="small"
            css={css`
              background-color: ${theme.colorFillQuaternary};
              border-radius: ${theme.borderRadiusSM}px;
              padding: ${theme.paddingSM}px ${theme.padding}px;
              margin-bottom: ${theme.margin}px;
            `}
          >
            <Icons.LinkOutlined iconColor={theme.colorTextTertiary} />
            <Typography.Text
              css={css`
                font-family: ${theme.fontFamilyCode};
                font-size: ${theme.fontSize}px;
                word-break: break-all;
              `}
            >
              {targetUrl}
            </Typography.Text>
          </Flex>

          <Flex align="center" gap="small">
            <Checkbox
              checked={trustChecked}
              onChange={e => setTrustChecked(e.target.checked)}
            >
              {t("Trust this URL and don't ask again")}
            </Checkbox>
          </Flex>

          <Typography.Text type="secondary">
            {t('Only proceed if you trust the destination or its source.')}
          </Typography.Text>
        </div>

        <Flex
          justify="flex-end"
          gap="small"
          css={css`
            padding: ${theme.padding}px ${theme.paddingXL}px;
            background-color: ${theme.colorFillAlter};
            border-top: 1px solid ${theme.colorBorderSecondary};
          `}
        >
          <Button onClick={handleReturn}>{t('Return to Superset')}</Button>
          <Button type="primary" onClick={handleContinue}>
            {t('Continue')}
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
}
