/* eslint-disable react/prop-types */
import { t } from "ttag";
import type { SearchSidebarFilterComponent } from "metabase/search/types";
import { Group, Text } from "metabase/ui";
import { Icon } from "metabase/core/components/Icon";
import { getTranslatedEntityName } from "metabase/nav/utils";

export const TypeFilterDisplay: SearchSidebarFilterComponent<"type">["Display"] =
  ({ value }) => {
    if (!value || value.length === 0) {
      return (
        <Group noWrap>
          <Icon name={"dashboard"} />
          <Text weight={700}>Content type</Text>
        </Group>
      );
    }

    let titleText = "";
    if (value.length === 1) {
      titleText = getTranslatedEntityName(value[0]) ?? t`1 type selected`;
    } else {
      titleText = value.length + t` types selected`;
    }
    return (
      <Text c="inherit" weight={700}>
        {titleText}
      </Text>
    );
  };
