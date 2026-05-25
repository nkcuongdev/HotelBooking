import { useEffect, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import SearchBar from "../components/SearchBar";
import {
  MobileFilterSidebar,
  DesktopFilterSidebar,
} from "../components/FilterSidebar";
import HotelGrid from "../components/HotelGrid";
import api from "../services/api";

const PRICE_MAX = 10000000;

const Hotels = () => {
  const [searchParams] = useSearchParams();
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hotels, setHotels] = useState([]);
  const [error, setError] = useState(null);
  const initialLocation = searchParams.get("city") || searchParams.get("location") || "";
  const [searchQuery, setSearchQuery] = useState({
    location: initialLocation,
    checkIn: searchParams.get("checkIn") || "",
    checkOut: searchParams.get("checkOut") || "",
    guests: searchParams.get("guests") || 1,
  });

  useEffect(() => {
    const city = searchParams.get("city") || searchParams.get("location") || "";
    if (city) {
      setSearchQuery((prev) => ({ ...prev, location: city }));
    }
  }, [searchParams]);

  const [filters, setFilters] = useState({
    priceRange: { min: 0, max: PRICE_MAX },
    rating: null,
    cities: [],
  });
  const [sortBy, setSortBy] = useState("recommended");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  useEffect(() => {
    const fetchHotels = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getHotels();
        const data = res.data || res.hotels || res || [];
        setHotels(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Không thể tải danh sách khách sạn");
      } finally {
        setLoading(false);
      }
    };
    fetchHotels();
  }, []);

  const normalizeHotel = (hotel) => ({
    ...(hotel || {}),
    id: hotel?._id || hotel?.id,
    location: [hotel?.address, hotel?.city].filter(Boolean).join(", ") || hotel?.location || "",
    city: hotel?.city || hotel?.location || "",
    image: hotel?.images?.[0] || hotel?.image || "",
    price: hotel?.minRoomPrice ?? hotel?.pricePerNight ?? hotel?.price ?? 0,
    rating:
      hotel?.averageRating ??
      hotel?.rating ??
      0,
    reviews:
      hotel?.numReviews ??
      hotel?.totalReviews ??
      (Array.isArray(hotel?.reviews) ? hotel.reviews.length : hotel?.reviews) ??
      0,
    amenities: hotel?.amenities || [],
  });

  const normalizedHotels = useMemo(
    () => hotels.map(normalizeHotel),
    [hotels]
  );

  const availableCities = useMemo(() => {
    const citySet = new Set(
      normalizedHotels.map((h) => h.city).filter(Boolean)
    );
    return [...citySet].sort((a, b) => a.localeCompare(b, "vi")).slice(0, 10);
  }, [normalizedHotels]);

  const filteredHotels = useMemo(() => {
    return normalizedHotels.filter((hotel) => {
      if (
        hotel.price < filters.priceRange.min ||
        hotel.price > filters.priceRange.max
      ) {
        return false;
      }
      if (filters.rating && hotel.rating < filters.rating) {
        return false;
      }
      if (filters.cities.length > 0) {
        const hotelLocation = `${hotel.city || ""} ${hotel.location || ""}`.toLowerCase();
        const isInSelectedCity = filters.cities.some((city) =>
          hotelLocation.includes(city.toLowerCase())
        );
        if (!isInSelectedCity) return false;
      }
      if (searchQuery.location) {
        const searchLower = searchQuery.location.toLowerCase();
        const locationStr = (hotel.location || hotel.city || "").toLowerCase();
        const nameStr = (hotel.name || "").toLowerCase();
        if (!locationStr.includes(searchLower) && !nameStr.includes(searchLower)) {
          return false;
        }
      }
      return true;
    });
  }, [filters, normalizedHotels, searchQuery]);

  const sortedHotels = useMemo(() => {
    const sorted = [...filteredHotels];
    switch (sortBy) {
      case "price-low":
        return sorted.sort((a, b) => a.price - b.price);
      case "price-high":
        return sorted.sort((a, b) => b.price - a.price);
      case "rating":
        return sorted.sort((a, b) => b.rating - a.rating);
      default:
        return sorted;
    }
  }, [filteredHotels, sortBy]);

  const totalPages = Math.ceil(sortedHotels.length / itemsPerPage);
  const paginatedHotels = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedHotels.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedHotels, currentPage]);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearch = (data) => {
    setSearchQuery(data);
    setCurrentPage(1);
  };

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const activeFiltersCount =
    (filters.rating ? 1 : 0) +
    filters.cities.length +
    (filters.priceRange.min > 0 || filters.priceRange.max < PRICE_MAX ? 1 : 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <SearchBar onSearch={handleSearch} initialValues={searchQuery} />
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => setIsFilterOpen(true)}
            className="lg:hidden flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={18} />
            <span className="font-medium">Bộ lọc</span>
            {activeFiltersCount > 0 && (
              <span className="w-5 h-5 bg-[#FF385C] text-white text-xs rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <label className="text-sm text-gray-600 hidden sm:block">
              Sắp xếp theo:
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-[#FF385C] focus:border-transparent outline-none cursor-pointer"
            >
              <option value="recommended">Đề xuất</option>
              <option value="price-low">Giá: thấp đến cao</option>
              <option value="price-high">Giá: cao đến thấp</option>
              <option value="rating">Đánh giá cao nhất</option>
            </select>
          </div>
        </div>

        <MobileFilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          isOpen={isFilterOpen}
          onClose={() => setIsFilterOpen(false)}
          availableCities={availableCities}
        />

        <div className="flex gap-8">
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-28 bg-white rounded-2xl border border-gray-200 p-6">
              <DesktopFilterSidebar
                filters={filters}
                onFilterChange={handleFilterChange}
                availableCities={availableCities}
              />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <HotelGrid
              hotels={paginatedHotels}
              loading={loading}
              totalResults={sortedHotels.length}
            />

            {totalPages > 1 && (
              <div className="mt-12 flex justify-center">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Trước
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          currentPage === page
                            ? "bg-[#FF385C] text-white"
                            : "border border-gray-200 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Hotels;
