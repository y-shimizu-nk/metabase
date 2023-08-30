/* eslint-disable react/prop-types */
import { isEmpty } from "underscore";
import type { MouseEvent } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import type {
  SearchFilterComponentProps,
  SearchSidebarFilterComponent,
} from "metabase/search/types";
import { Box, Button, Group, Paper } from "metabase/ui";
import { Icon } from "metabase/core/components/Icon";
import Popover from "metabase/components/Popover";
import {
  DropdownApplyButtonDivider,
  DropdownFilterElement,
} from "./SearchSidebarFilter.styled";

type SearchSidebarFilterProps = {
  filter: SearchSidebarFilterComponent;
} & SearchFilterComponentProps;

export const SearchSidebarFilter = ({
  filter: Filter,
  ...props
}: SearchSidebarFilterProps) => {
  const [selectedValues, setSelectedValues] = useState(props.value);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  const fieldHasValue = !isEmpty(props.value);

  const [popoverWidth, setPopoverWidth] = useState("100%");

  useLayoutEffect(() => {
    if (dropdownRef.current) {
      setPopoverWidth(`${dropdownRef.current?.offsetWidth}px`);
    }
  }, []);

  const onApplyFilter = () => {
    props.onChange(selectedValues);
  };

  const onClearFilter = (e: MouseEvent) => {
    if (fieldHasValue) {
      e.stopPropagation();
      setSelectedValues(undefined);
      props.onChange(undefined);
    }
  };

  return (
    <div data-testid={props["data-testid"]} ref={dropdownRef}>
      <div onClick={() => setIsPopoverOpen(true)}>
        <DropdownFilterElement
          noPadding
          fieldHasValueOrFocus={fieldHasValue}
          legend={fieldHasValue ? <Filter.Title value={props.value} /> : null}
        >
          <Group position="apart">
            <Filter.Display value={props.value} />
            <Button
              compact
              c="inherit"
              variant="subtle"
              onClick={onClearFilter}
              leftIcon={<Icon name={fieldHasValue ? "close" : "chevrondown"} />}
            />
          </Group>
        </DropdownFilterElement>
      </div>
      <Popover
        isOpen={isPopoverOpen}
        onClose={() => setIsPopoverOpen(false)}
        target={dropdownRef.current}
      >
        <Paper shadow="md" withBorder w={popoverWidth}>
          <Box p="md">
            <Filter.Content
              {...props}
              value={selectedValues}
              onChange={selected => setSelectedValues(selected)}
            />
          </Box>
          <DropdownApplyButtonDivider />
          <Group position="right" align="center" px="sm" pb="sm">
            <Button onClick={onApplyFilter}>Apply filters</Button>
          </Group>
        </Paper>
      </Popover>
    </div>
  );
};
