import { useState, useEffect } from 'react';
import { Star, X, SlidersHorizontal } from 'lucide-react';
import { formatVnd } from '../utils/currency';

const PRICE_MAX = 10000000;
const PRICE_STEP = 100000;

const FilterContent = ({ filters, onFilterChange, onClose, availableCities = [], showHeader = true, showCloseButton = false }) => {
  const [localFilters, setLocalFilters] = useState(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handlePriceChange = (type, value) => {
    const newFilters = {
      ...localFilters,
      priceRange: {
        ...localFilters.priceRange,
        [type]: Number(value),
      },
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleRatingChange = (rating) => {
    const newFilters = {
      ...localFilters,
      rating: localFilters.rating === rating ? null : rating,
    };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleCityChange = (cityLabel) => {
    const newCities = localFilters.cities.includes(cityLabel)
      ? localFilters.cities.filter((city) => city !== cityLabel)
      : [...localFilters.cities, cityLabel];

    const newFilters = { ...localFilters, cities: newCities };
    setLocalFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const clearedFilters = {
      priceRange: { min: 0, max: PRICE_MAX },
      rating: null,
      cities: [],
    };
    setLocalFilters(clearedFilters);
    onFilterChange(clearedFilters);
  };

  const hasActiveFilters = 
    localFilters.rating !== null || 
    localFilters.cities.length > 0 ||
    localFilters.priceRange.min > 0 ||
    localFilters.priceRange.max < PRICE_MAX;

  return (
    <div>
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={20} className="text-gray-700" />
            <h2 className="text-lg font-semibold text-gray-900">Bộ lọc</h2>
          </div>
          <div className="flex items-center gap-2">
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-[#FF385C] hover:underline cursor-pointer"
              >
                Xóa tất cả
              </button>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-100 rounded-full cursor-pointer"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Price Range */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Khoảng giá</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Giá thấp nhất</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">VNĐ</span>
                <input
                  type="number"
                  min="0"
                  max={localFilters.priceRange.max}
                  value={localFilters.priceRange.min}
                  onChange={(e) => handlePriceChange('min', e.target.value)}
                  className="w-full pl-11 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#FF385C] focus:border-transparent outline-none"
                />
              </div>
            </div>
            <span className="text-gray-400 mt-5">—</span>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Giá cao nhất</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">VNĐ</span>
                <input
                  type="number"
                  min={localFilters.priceRange.min}
                  max={PRICE_MAX}
                  value={localFilters.priceRange.max}
                  onChange={(e) => handlePriceChange('max', e.target.value)}
                  className="w-full pl-11 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#FF385C] focus:border-transparent outline-none"
                />
              </div>
            </div>
          </div>
          {/* Dual Range Slider */}
          <div className="relative h-2 mt-2">
            {/* Track background */}
            <div className="absolute inset-0 bg-gray-200 rounded-full" />
            {/* Active track */}
            <div
              className="absolute h-full bg-[#FF385C] rounded-full"
              style={{
                left: `${(localFilters.priceRange.min / PRICE_MAX) * 100}%`,
                right: `${100 - (localFilters.priceRange.max / PRICE_MAX) * 100}%`,
              }}
            />
            {/* Min slider */}
            <input
              type="range"
              min="0"
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={localFilters.priceRange.min}
              onChange={(e) => {
                const value = Math.min(Number(e.target.value), localFilters.priceRange.max - PRICE_STEP);
                handlePriceChange('min', value);
              }}
              className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#FF385C] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#FF385C] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md"
              style={{ zIndex: localFilters.priceRange.min > PRICE_MAX / 2 ? 5 : 3 }}
            />
            {/* Max slider */}
            <input
              type="range"
              min="0"
              max={PRICE_MAX}
              step={PRICE_STEP}
              value={localFilters.priceRange.max}
              onChange={(e) => {
                const value = Math.max(Number(e.target.value), localFilters.priceRange.min + PRICE_STEP);
                handlePriceChange('max', value);
              }}
              className="absolute w-full h-2 appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#FF385C] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#FF385C] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-md"
              style={{ zIndex: 4 }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 pt-2">
            <span>{formatVnd(0)}</span>
            <span>{formatVnd(PRICE_MAX)}+</span>
          </div>
        </div>
      </div>

      {/* Rating */}
      <div className="mb-6 pb-6 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Đánh giá của khách</h3>
        <div className="flex flex-wrap gap-2">
          {[5, 4, 3, 2, 1].map((rating) => (
            <button
              key={rating}
              onClick={() => handleRatingChange(rating)}
              className={`
                flex items-center gap-1 px-3 py-2 rounded-lg border text-sm font-medium
                transition-colors cursor-pointer
                ${localFilters.rating === rating
                  ? 'border-[#FF385C] bg-[#FF385C]/10 text-[#FF385C]'
                  : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }
              `}
            >
              <Star size={14} className={localFilters.rating === rating ? 'fill-[#FF385C]' : ''} />
              {rating}+
            </button>
          ))}
        </div>
      </div>

      {/* Cities */}
      {availableCities.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Địa điểm</h3>
          <div className="space-y-2">
            {availableCities.map((cityLabel) => (
              <label
                key={cityLabel}
                className="flex items-center gap-3 cursor-pointer group"
              >
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={localFilters.cities.includes(cityLabel)}
                    onChange={() => handleCityChange(cityLabel)}
                    className="sr-only peer"
                  />
                  <div className="w-5 h-5 border-2 border-gray-300 rounded peer-checked:border-[#FF385C] peer-checked:bg-[#FF385C] transition-colors">
                    {localFilters.cities.includes(cityLabel) && (
                      <svg className="w-full h-full text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-sm text-gray-700 group-hover:text-gray-900">
                  {cityLabel}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Mobile Filter Sidebar (Overlay)
const MobileFilterSidebar = ({ filters, onFilterChange, isOpen, onClose, availableCities = [] }) => {
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 w-80 bg-white overflow-y-auto lg:hidden">
        <div className="p-6">
          <FilterContent 
            filters={filters} 
            onFilterChange={onFilterChange} 
            onClose={onClose}
            availableCities={availableCities}
            showCloseButton={true}
          />
        </div>
      </aside>
    </>
  );
};

// Desktop Filter Sidebar (Static)
const DesktopFilterSidebar = ({ filters, onFilterChange, availableCities = [] }) => {
  return (
    <FilterContent 
      filters={filters} 
      onFilterChange={onFilterChange} 
      onClose={() => {}}
      availableCities={availableCities}
      showCloseButton={false}
    />
  );
};

export { MobileFilterSidebar, DesktopFilterSidebar };
export default MobileFilterSidebar;
