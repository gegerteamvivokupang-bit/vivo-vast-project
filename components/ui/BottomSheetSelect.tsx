'use client';

import { useState } from 'react';
import { ChevronDown, Search, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from '@/components/ui/drawer';
import { Label } from '@/components/ui/label';

interface Option {
    value: string;
    label: string;
}

interface BottomSheetSelectProps {
    label?: string;
    placeholder?: string;
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    disabled?: boolean;
    searchable?: boolean;
    icon?: string;
}

export default function BottomSheetSelect({
    label,
    placeholder = 'Pilih...',
    options,
    value,
    onChange,
    required = false,
    disabled = false,
    searchable = false,
    icon,
}: BottomSheetSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Get selected option label
    const selectedOption = options.find(opt => opt.value === value);
    const displayValue = selectedOption?.label || '';

    // Filter options based on search
    const filteredOptions = searchable && searchQuery
        ? options.filter(opt =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : options;

    // Handle option select
    const handleSelect = (optionValue: string) => {
        onChange(optionValue);
        setIsOpen(false);
        setSearchQuery('');
    };

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            {/* Trigger Button */}
            <div>
                {label && (
                    <Label className="block text-xs text-muted-foreground mb-1">
                        {label} {required && '*'}
                    </Label>
                )}
                <DrawerTrigger asChild disabled={disabled}>
                    <button
                        type="button"
                        disabled={disabled}
                        className={cn(
                            "w-full p-3 border rounded-xl text-left flex items-center justify-between transition-all",
                            disabled
                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                : 'bg-background border-input hover:border-primary focus:ring-2 focus:ring-ring focus:border-transparent'
                        )}
                    >
                        <span className={cn(
                            "flex items-center gap-2",
                            !displayValue ? 'text-muted-foreground' : 'text-foreground'
                        )}>
                            {icon && <span>{icon}</span>}
                            {displayValue || placeholder}
                        </span>
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    </button>
                </DrawerTrigger>
            </div>

            {/* Bottom Sheet Content */}
            <DrawerContent className="max-h-[80vh]">
                <DrawerHeader className="border-b">
                    <div className="flex items-center justify-between">
                        <DrawerTitle className="flex items-center gap-2">
                            {icon && <span>{icon}</span>}
                            {label || 'Pilih Opsi'}
                        </DrawerTitle>
                        <DrawerClose asChild>
                            <button
                                type="button"
                                className="p-2 hover:bg-accent rounded-full transition-colors"
                            >
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </DrawerClose>
                    </div>

                    {/* Search input */}
                    {searchable && (
                        <div className="mt-3 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cari..."
                                className="w-full pl-10 pr-4 py-2.5 border border-input rounded-xl bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                            />
                        </div>
                    )}
                </DrawerHeader>

                {/* Options List */}
                <div className="flex-1 overflow-y-auto px-2 py-2 max-h-[50vh]">
                    {filteredOptions.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                            Tidak ada hasil
                        </div>
                    ) : (
                        filteredOptions.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => handleSelect(option.value)}
                                className={cn(
                                    "w-full p-3 rounded-xl text-left flex items-center justify-between transition-all mb-1",
                                    option.value === value
                                        ? 'bg-primary/10 text-primary font-medium'
                                        : 'hover:bg-accent text-foreground'
                                )}
                            >
                                <span>{option.label}</span>
                                {option.value === value && (
                                    <Check className="h-5 w-5 text-primary" />
                                )}
                            </button>
                        ))
                    )}
                </div>

                {/* Safe area for mobile */}
                <div className="h-6 bg-background" />
            </DrawerContent>
        </Drawer>
    );
}
