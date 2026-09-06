import { Autocomplete, Box, TextField, Avatar } from '@mui/material';
import { Item } from '../types';

type Props = {
  items: Item[];
  onSelect: (item: Item) => void;
  disabled?: boolean;
};

export default function ItemPicker({ items, onSelect, disabled }: Props) {
  return (
    <Autocomplete
      options={items}
      disabled={disabled}
      clearOnBlur
      blurOnSelect
      value={null}
      getOptionLabel={(o) => `${o.articleNumber} — ${o.productName}`}
      filterOptions={(opts, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return opts.slice(0, 50);
        return opts
          .filter(
            (o) =>
              o.articleNumber.toLowerCase().includes(q) ||
              o.productName.toLowerCase().includes(q)
          )
          .slice(0, 50);
      }}
      renderOption={(props, o) => {
        const { key, ...rest } = props as any;
        return (
          <li key={o.id} {...rest}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
              <Avatar
                src={o.imageUrl || undefined}
                variant="rounded"
                sx={{ width: 36, height: 36, bgcolor: 'grey.200', fontSize: 12 }}
              >
                IMG
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ fontWeight: 600 }}>{o.articleNumber}</Box>
                <Box sx={{ fontSize: 13, color: 'text.secondary' }}>{o.productName}</Box>
              </Box>
              <Box sx={{ fontWeight: 600 }}>${o.priceUSD.toFixed(2)}</Box>
            </Box>
          </li>
        );
      }}
      onChange={(_e, v) => {
        if (v) onSelect(v);
      }}
      renderInput={(params) => (
        <TextField {...params} label="Add Item — search by article number or name" placeholder="Type 250..." />
      )}
    />
  );
}
