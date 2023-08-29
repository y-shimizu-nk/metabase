/* eslint-disable react/prop-types */
import type { ComponentProps, ReactNode, MouseEvent } from "react";
import { useRef, useState } from "react";
import { isEmpty } from "underscore";
import { Box, Button, Group, Loader, Text, Paper } from "metabase/ui";
import type {
  SearchFilterComponent,
  SearchFilterPropTypes,
} from "metabase/search/types";
import { Icon } from "metabase/core/components/Icon";
import Popover from "metabase/components/Popover";
import {
  DropdownApplyButtonDivider,
  DropdownDisplayElement,
  DropdownFilterElement,
} from "metabase/search/components/SearchFilterSidebar/dropdown-filter/DropdownSearchFilter.styled";

type DropdownSearchFilterProps = ComponentProps<SearchFilterComponent> & {
  title: string;
  isLoading: boolean;
  tooltip?: string;
  applyImmediatelyOnChange?: boolean;
  children: (
    data: SearchFilterPropTypes[keyof SearchFilterPropTypes],
    updateData: (
      val: SearchFilterPropTypes[keyof SearchFilterPropTypes],
    ) => void,
  ) => ReactNode;
  displayText: string;
  displayIcon: string;
};

export const DropdownSearchFilter = ({
  value,
  onChange,
  title,
  tooltip,
  isLoading,
  "data-testid": dataTestId,
  children,
  displayIcon,
  displayText,
  applyImmediatelyOnChange = false,
}: DropdownSearchFilterProps) => {
  const [selectedValues, setSelectedValues] = useState(value);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const filterHasValue = !isEmpty(value);

  const dropdownRef = useRef(null);

  const onChangeFilter = (elems: unknown) => {
    setSelectedValues(elems);
    if (applyImmediatelyOnChange) {
      onChange(elems);
    }
  };

  const onApplyFilter = () => {
    onChange(selectedValues);
    setIsPopoverOpen(false);
  };

  const onClearFilter = (e: MouseEvent) => {
    if (filterHasValue) {
      e.stopPropagation();
      setSelectedValues(undefined);
      onChange(undefined);
    }
  };

  const renderPopoverContent = () => (
    <>
      <Box p="md">{children && children(selectedValues, onChangeFilter)}</Box>
      {!applyImmediatelyOnChange && (
        <>
          <DropdownApplyButtonDivider />
          <Group position="right" align="center" px="sm" pb="sm">
            <Button onClick={onApplyFilter}>Apply filters</Button>
          </Group>
        </>
      )}
    </>
  );

  return (
    <div data-testid={dataTestId} ref={dropdownRef}>
      <DropdownFilterElement
        fieldHasValueOrFocus={isPopoverOpen || filterHasValue}
        legend={filterHasValue && title}
        noPadding={false}
      >
        <DropdownDisplayElement
          position="apart"
          noWrap
          onClick={() => {
            setIsPopoverOpen(!isPopoverOpen);
          }}
        >
          <Group noWrap>
            <Icon name="dashboard" />
            <Text c="inherit" truncate weight={700}>
              {displayText || title}
            </Text>
          </Group>
          <Button
            compact
            c="inherit"
            variant="subtle"
            onClick={onClearFilter}
            leftIcon={<Icon name={filterHasValue ? "close" : "chevrondown"} />}
          />
        </DropdownDisplayElement>
      </DropdownFilterElement>
      <Popover
        target={dropdownRef.current}
        isOpen={isPopoverOpen}
        onClose={() => {
          setIsPopoverOpen(false);
          setSelectedValues(value);
        }}
        autoWidth
      >
        <Paper withBorder shadow="md" miw="17.5rem">
          {isLoading ? <Loader /> : renderPopoverContent()}
        </Paper>
      </Popover>
    </div>
  );
};
