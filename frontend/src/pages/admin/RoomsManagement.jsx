import { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Users,
  X,
  Link,
  DoorOpen,
  ChevronDown,
  Building2,
  Loader2,
} from "lucide-react";
import { roomAmenities, getIconComponent } from "../../data/amenities";
import api from "../../services/api";
import { formatVnd } from "../../utils/currency";

const RoomsManagement = () => {
  const location = useLocation();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allHotels, setAllHotels] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [hotelFilter, setHotelFilter] = useState("");
  const [availabilityFilter, setAvailabilityFilter] = useState("");
  const [priceSort, setPriceSort] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingRoom, setViewingRoom] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    title: "",
    hotel: "",
    price: "",
    maxPeople: "",
    description: "",
    totalRooms: "",
    availableRooms: "",
  });
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [hotelSearchText, setHotelSearchText] = useState("");
  const [showHotelDropdown, setShowHotelDropdown] = useState(false);
  const hotelDropdownRef = useRef(null);

  // Close hotel dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        hotelDropdownRef.current &&
        !hotelDropdownRef.current.contains(e.target)
      ) {
        setShowHotelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [roomsRes, hotelsRes] = await Promise.all([
          api.getRooms({ limit: 200 }),
          api.getHotels({ limit: 100 }),
        ]);
        const roomData = roomsRes.data || roomsRes.rooms || roomsRes || [];
        setRooms(
          (Array.isArray(roomData) ? roomData : []).map((r) => ({
            ...r,
            id: r._id || r.id,
            title: r.title || r.name || "",
            hotel:
              r.hotelId?.name || r.hotel?.name || r.hotelName || r.hotel || "",
            hotelId:
              r.hotelId?._id || r.hotel?._id || r.hotelId || r.hotel || "",
            price: r.price || r.pricePerNight || 0,
            maxPeople: r.maxPeople || r.maxOccupancy || 2,
            totalRooms: r.totalRooms || r.quantity || 0,
            availableRooms: r.availableRooms ?? r.totalRooms ?? r.quantity ?? 0,
            image: r.images?.[0] || r.image || "",
            images: r.images || (r.image ? [r.image] : []),
            amenities: r.amenities || [],
          })),
        );
        const hotelData = hotelsRes.data || hotelsRes.hotels || hotelsRes || [];
        setAllHotels(
          (Array.isArray(hotelData) ? hotelData : []).map((h) => ({
            id: h._id || h.id,
            name: h.name,
          })),
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredHotelOptions = allHotels.filter((h) =>
    h.name.toLowerCase().includes(hotelSearchText.toLowerCase()),
  );

  // Check if navigated from HotelsManagement with a filter
  useEffect(() => {
    if (location.state?.filterHotel) {
      setHotelFilter(location.state.filterHotel);
    }
  }, [location.state]);
  const [imagePreview, setImagePreview] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  const handleView = (room) => {
    setViewingRoom(room);
    setShowViewModal(true);
    setActiveDropdown(null);
  };

  const itemsPerPage = 5;
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch =
      room.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      room.hotel.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesHotel = hotelFilter ? room.hotel === hotelFilter : true;
    const matchesAvailability =
      availabilityFilter === "available"
        ? room.availableRooms > 0
        : availabilityFilter === "full"
          ? room.availableRooms === 0
          : true;
    return matchesSearch && matchesHotel && matchesAvailability;
  });

  // Sort by price if selected
  const sortedFilteredRooms = [...filteredRooms].sort((a, b) => {
    if (priceSort === "asc") return a.price - b.price;
    if (priceSort === "desc") return b.price - a.price;
    return 0;
  });

  const hasActiveFilters = hotelFilter || availabilityFilter || priceSort;

  const clearAllFilters = () => {
    setHotelFilter("");
    setAvailabilityFilter("");
    setPriceSort("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const hotelNames = [
    ...new Set(rooms.map((room) => room.hotel).filter(Boolean)),
  ];

  const totalPages = Math.ceil(sortedFilteredRooms.length / itemsPerPage);
  const paginatedRooms = sortedFilteredRooms.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleEdit = (room) => {
    setEditingRoom(room);
    setFormData({
      title: room.title,
      hotel: room.hotel,
      price: room.price.toString(),
      maxPeople: room.maxPeople.toString(),
      description: room.description || "",
      totalRooms: room.totalRooms.toString(),
      availableRooms: room.availableRooms.toString(),
    });
    setSelectedAmenities(room.amenities || []);
    setImagePreview(room.images || (room.image ? [room.image] : []));
    setNewImageUrl("");
    setHotelSearchText(room.hotel);
    setShowHotelDropdown(false);
    setShowModal(true);
    setActiveDropdown(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa loại phòng này?")) return;
    setActiveDropdown(null);
    try {
      await api.deleteRoom(id);
      setRooms((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.message || "Xóa thất bại");
    }
  };

  const handleAddNew = () => {
    setEditingRoom(null);
    setFormData({
      title: "",
      hotel: "",
      price: "",
      maxPeople: "",
      description: "",
      totalRooms: "",
      availableRooms: "",
    });
    setSelectedAmenities([]);
    setImagePreview([]);
    setNewImageUrl("");
    setHotelSearchText("");
    setShowHotelDropdown(false);
    setShowModal(true);
  };

  const toggleAmenity = (amenityId) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenityId)
        ? prev.filter((id) => id !== amenityId)
        : [...prev, amenityId],
    );
  };

  const handleAddImageUrl = () => {
    const url = newImageUrl.trim();
    if (!url) return;
    setImagePreview((prev) => [...prev, url]);
    setNewImageUrl("");
  };

  const handleRemoveImage = (index) => {
    setImagePreview((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    const totalRooms = parseInt(formData.totalRooms) || 0;
    const availableRooms = Math.min(
      parseInt(formData.availableRooms) || 0,
      totalRooms,
    );
    const selectedHotel = allHotels.find((h) => h.name === formData.hotel);

    const payload = {
      title: formData.title,
      hotelId: selectedHotel?.id || formData.hotel,
      price: parseInt(formData.price),
      maxPeople: parseInt(formData.maxPeople),
      totalRooms,
      availableRooms,
      description: formData.description,
      amenities: selectedAmenities,
      images: imagePreview.length > 0 ? imagePreview : undefined,
    };

    try {
      if (editingRoom) {
        const res = await api.updateRoom(editingRoom.id, payload);
        const updated = res.data || res;
        setRooms((prev) =>
          prev.map((r) =>
            r.id === editingRoom.id
              ? {
                  ...r,
                  ...updated,
                  id: updated._id || updated.id || editingRoom.id,
                  title: updated.title || updated.name || formData.title,
                  hotel: formData.hotel,
                  hotelId: updated.hotelId?._id || updated.hotelId || r.hotelId,
                  price:
                    updated.price ||
                    updated.pricePerNight ||
                    parseInt(formData.price),
                  maxPeople:
                    updated.maxPeople ||
                    updated.maxOccupancy ||
                    parseInt(formData.maxPeople),
                  totalRooms,
                  availableRooms,
                  amenities: selectedAmenities,
                  image: updated.images?.[0] || imagePreview[0] || r.image,
                  images: updated.images || imagePreview,
                }
              : r,
          ),
        );
      } else {
        const res = await api.createRoom(payload);
        const created = res.data || res;
        setRooms((prev) => [
          ...prev,
          {
            ...created,
            id: created._id || created.id,
            title: created.title || created.name || formData.title,
            hotel: formData.hotel,
            hotelId:
              created.hotelId?._id ||
              created.hotelId ||
              selectedHotel?.id ||
              "",
            price:
              created.price ||
              created.pricePerNight ||
              parseInt(formData.price),
            maxPeople:
              created.maxPeople ||
              created.maxOccupancy ||
              parseInt(formData.maxPeople),
            totalRooms,
            availableRooms,
            amenities: selectedAmenities,
            image: created.images?.[0] || imagePreview[0] || "",
            images: created.images || imagePreview,
          },
        ]);
      }
      setShowModal(false);
      setSelectedAmenities([]);
      setImagePreview([]);
      setNewImageUrl("");
    } catch (err) {
      alert(err.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Quản lý loại phòng
          </h1>
          <p className="text-gray-500 mt-1">
            Quản lý các loại phòng của từng khách sạn
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF385C] text-white font-medium rounded-lg hover:bg-[#E31C5F] transition-colors cursor-pointer"
        >
          <Plus size={20} />
          Thêm loại phòng
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Tìm kiếm loại phòng..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
          />
        </div>
        <select
          value={hotelFilter}
          onChange={(e) => {
            setHotelFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] cursor-pointer"
        >
          <option value="">Tất cả khách sạn</option>
          {hotelNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={availabilityFilter}
          onChange={(e) => {
            setAvailabilityFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] cursor-pointer"
        >
          <option value="">Tình trạng phòng</option>
          <option value="available">Còn phòng trống</option>
          <option value="full">Hết phòng</option>
        </select>
        <select
          value={priceSort}
          onChange={(e) => {
            setPriceSort(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] cursor-pointer"
        >
          <option value="">Sắp xếp giá</option>
          <option value="asc">Giá tăng dần</option>
          <option value="desc">Giá giảm dần</option>
        </select>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[#FF385C] border border-[#FF385C] rounded-lg hover:bg-[#FF385C]/5 transition-colors cursor-pointer"
          >
            <X size={18} />
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Đang lọc:</span>
          {hotelFilter && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF385C]/10 text-[#FF385C] rounded-full text-sm font-medium">
              {hotelFilter}
              <button
                onClick={() => {
                  setHotelFilter("");
                  setCurrentPage(1);
                }}
                className="p-0.5 hover:bg-[#FF385C]/20 rounded-full cursor-pointer"
              >
                <X size={14} />
              </button>
            </span>
          )}
          {availabilityFilter && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF385C]/10 text-[#FF385C] rounded-full text-sm font-medium">
              {availabilityFilter === "available"
                ? "Còn phòng trống"
                : "Hết phòng"}
              <button
                onClick={() => {
                  setAvailabilityFilter("");
                  setCurrentPage(1);
                }}
                className="p-0.5 hover:bg-[#FF385C]/20 rounded-full cursor-pointer"
              >
                <X size={14} />
              </button>
            </span>
          )}
          {priceSort && (
            <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#FF385C]/10 text-[#FF385C] rounded-full text-sm font-medium">
              {priceSort === "asc" ? "Giá tăng dần" : "Giá giảm dần"}
              <button
                onClick={() => {
                  setPriceSort("");
                  setCurrentPage(1);
                }}
                className="p-0.5 hover:bg-[#FF385C]/20 rounded-full cursor-pointer"
              >
                <X size={14} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-[#FF385C]" />
          </div>
        ) : null}
        <div className={`overflow-x-auto ${loading ? "hidden" : ""}`}>
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 font-medium">Loại phòng</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">
                  Khách sạn
                </th>
                <th className="px-6 py-4 font-medium">Giá</th>
                <th className="px-6 py-4 font-medium hidden lg:table-cell">
                  Sức chứa
                </th>
                <th className="px-6 py-4 font-medium">Phòng trống</th>
                <th className="px-6 py-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRooms.map((room) => (
                <tr
                  key={room.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={room.image}
                        alt={room.title}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {room.title}
                        </p>
                        <p className="text-sm text-gray-500 md:hidden">
                          {room.hotel}
                        </p>
                        {room.amenities && room.amenities.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            {room.amenities.slice(0, 4).map((amenityId) => {
                              const amenity = roomAmenities.find(
                                (a) => a.id === amenityId,
                              );
                              if (!amenity) return null;
                              const Icon = getIconComponent(amenity.icon);
                              return (
                                <span
                                  key={amenityId}
                                  title={amenity.name}
                                  className="p-1 bg-purple-50 rounded text-purple-500"
                                >
                                  <Icon size={12} />
                                </span>
                              );
                            })}
                            {room.amenities.length > 4 && (
                              <span className="text-xs text-gray-400">
                                +{room.amenities.length - 4}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <span className="text-sm text-gray-700">{room.hotel}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-semibold text-gray-900">
                      {formatVnd(room.price)}
                    </span>
                    <span className="text-sm text-gray-500">/đêm</span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Users size={14} />
                      <span className="text-sm">{room.maxPeople} khách</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <DoorOpen
                        size={16}
                        className={
                          room.availableRooms > 0
                            ? "text-green-600"
                            : "text-red-500"
                        }
                      />
                      <span
                        className={`font-medium ${
                          room.availableRooms > 0
                            ? "text-green-600"
                            : "text-red-500"
                        }`}
                      >
                        {room.availableRooms}/{room.totalRooms}
                      </span>
                      <span className="text-xs text-gray-500">trống</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end relative">
                      <button
                        onClick={() =>
                          setActiveDropdown(
                            activeDropdown === room.id ? null : room.id,
                          )
                        }
                        className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                      >
                        <MoreVertical size={18} className="text-gray-500" />
                      </button>

                      {activeDropdown === room.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                          <button
                            onClick={() => handleView(room)}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                          >
                            <Eye size={16} />
                            Xem
                          </button>
                          <button
                            onClick={() => handleEdit(room)}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                          >
                            <Edit size={16} />
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(room.id)}
                            className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50 cursor-pointer"
                          >
                            <Trash2 size={16} />
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Hiển thị {paginatedRooms.length} / {sortedFilteredRooms.length} loại
            phòng
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer ${
                  currentPage === page
                    ? "bg-[#FF385C] text-white"
                    : "border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingRoom ? "Sửa loại phòng" : "Thêm loại phòng mới"}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên loại phòng
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                  placeholder="VD: Deluxe Ocean View, Family Suite..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Khách sạn
                </label>
                <div className="relative" ref={hotelDropdownRef}>
                  <div
                    className={`flex items-center gap-2 w-full px-4 py-2.5 border rounded-lg cursor-text transition-all ${
                      showHotelDropdown
                        ? "border-[#FF385C] ring-2 ring-[#FF385C]/20"
                        : formData.hotel
                          ? "border-gray-300"
                          : "border-gray-200"
                    }`}
                    onClick={() => {
                      setShowHotelDropdown(true);
                      setHotelSearchText("");
                    }}
                  >
                    <Building2 size={16} className="text-gray-400 shrink-0" />
                    {showHotelDropdown ? (
                      <input
                        autoFocus
                        type="text"
                        value={hotelSearchText}
                        onChange={(e) => setHotelSearchText(e.target.value)}
                        placeholder="Gõ để tìm khách sạn..."
                        className="flex-1 outline-none text-sm bg-transparent"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className={`flex-1 text-sm ${formData.hotel ? "text-gray-900" : "text-gray-400"}`}
                      >
                        {formData.hotel || "Chọn khách sạn"}
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={`text-gray-400 shrink-0 transition-transform ${showHotelDropdown ? "rotate-180" : ""}`}
                    />
                  </div>

                  {/* Hidden input for form validation */}
                  <input
                    type="text"
                    name="hotel"
                    value={formData.hotel}
                    required
                    readOnly
                    className="sr-only"
                    tabIndex={-1}
                  />

                  {showHotelDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      <div className="max-h-52 overflow-y-auto">
                        {filteredHotelOptions.length > 0 ? (
                          filteredHotelOptions.map((hotel) => (
                            <button
                              key={hotel.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  hotel: hotel.name,
                                }));
                                setHotelSearchText(hotel.name);
                                setShowHotelDropdown(false);
                              }}
                              className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm text-left hover:bg-[#FF385C]/5 transition-colors cursor-pointer ${
                                formData.hotel === hotel.name
                                  ? "bg-[#FF385C]/10 text-[#FF385C] font-medium"
                                  : "text-gray-700"
                              }`}
                            >
                              <Building2
                                size={14}
                                className="shrink-0 text-gray-400"
                              />
                              {hotel.name}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-6 text-center text-sm text-gray-400">
                            Không tìm thấy khách sạn nào
                          </div>
                        )}
                      </div>
                      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                        <p className="text-xs text-gray-400">
                          {filteredHotelOptions.length} / {allHotels.length}{" "}
                          khách sạn
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá (VNĐ/đêm)
                  </label>
                  <input
                    type="number"
                    name="price"
                    value={formData.price}
                    onChange={handleFormChange}
                    required
                    min="1"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                    placeholder="Giá phòng"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số khách tối đa
                  </label>
                  <input
                    type="number"
                    name="maxPeople"
                    value={formData.maxPeople}
                    onChange={handleFormChange}
                    required
                    min="1"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                    placeholder="Sức chứa"
                  />
                </div>
              </div>

              {/* Số lượng phòng */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tổng số phòng
                  </label>
                  <input
                    type="number"
                    name="totalRooms"
                    value={formData.totalRooms}
                    onChange={handleFormChange}
                    required
                    min="1"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                    placeholder="Tổng số phòng"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số phòng trống
                  </label>
                  <input
                    type="number"
                    name="availableRooms"
                    value={formData.availableRooms}
                    onChange={handleFormChange}
                    required
                    min="0"
                    max={formData.totalRooms || 999}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                    placeholder="Phòng còn trống"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 -mt-2">
                Số phòng trống sẽ tự động giảm khi có đặt phòng mới
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows={2}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] resize-none"
                  placeholder="Mô tả về loại phòng"
                />
              </div>

              {/* Image URL Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hình ảnh
                </label>
                <div className="flex gap-2 mb-3">
                  <div className="flex-1 relative">
                    <Link size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddImageUrl())}
                      placeholder="Dán URL ảnh vào đây..."
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddImageUrl}
                    className="px-4 py-2.5 bg-[#FF385C] text-white rounded-lg hover:bg-[#E31C5F] transition-colors cursor-pointer text-sm font-medium"
                  >
                    Thêm
                  </button>
                </div>
                {imagePreview.length > 0 && (
                  <div className="grid grid-cols-4 gap-3">
                    {imagePreview.map((src, index) => (
                      <div
                        key={index}
                        className="relative aspect-square rounded-lg overflow-hidden group border border-gray-200"
                      >
                        <img
                          src={src}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }}
                        />
                        <div className="hidden w-full h-full items-center justify-center bg-gray-100 text-xs text-gray-400 text-center p-1">
                          URL không hợp lệ
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(index)}
                          className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                        {index === 0 && (
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-[#FF385C] text-white text-xs rounded">
                            Ảnh chính
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-gray-400 mt-2">Nhập URL ảnh rồi nhấn "Thêm". Ảnh đầu tiên sẽ là ảnh chính.</p>
              </div>

              {/* Amenities Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tiện nghi phòng
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                  {roomAmenities.map((amenity) => {
                    const Icon = getIconComponent(amenity.icon);
                    const isSelected = selectedAmenities.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                          isSelected
                            ? "border-purple-500 bg-purple-50 text-purple-600"
                            : "border-gray-200 hover:border-gray-300 text-gray-600"
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-sm">{amenity.name}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedAmenities.length > 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Đã chọn: {selectedAmenities.length} tiện nghi
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 bg-[#FF385C] text-white font-medium rounded-lg hover:bg-[#E31C5F] cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editingRoom ? "Lưu thay đổi" : "Thêm loại phòng"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {showViewModal && viewingRoom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Chi tiết loại phòng
              </h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Images */}
              <div className="grid grid-cols-3 gap-3">
                {(viewingRoom.images || [viewingRoom.image]).map(
                  (img, index) => (
                    <img
                      key={index}
                      src={img}
                      alt={`${viewingRoom.title} ${index + 1}`}
                      className={`rounded-lg object-cover ${
                        index === 0 ? "col-span-2 row-span-2 h-64" : "h-30"
                      }`}
                    />
                  ),
                )}
              </div>

              {/* Info */}
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {viewingRoom.title}
                </h3>
                <p className="text-gray-600 mb-4">{viewingRoom.hotel}</p>
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-3xl font-bold text-[#FF385C]">
                      {formatVnd(viewingRoom.price)}
                    </span>
                    <span className="text-gray-500">/đêm</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users size={18} />
                    <span>Tối đa {viewingRoom.maxPeople} khách</span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {viewingRoom.description && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Mô tả</h4>
                  <p className="text-gray-600">{viewingRoom.description}</p>
                </div>
              )}

              {/* Room Amenities */}
              {viewingRoom.amenities && viewingRoom.amenities.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Tiện nghi phòng
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {viewingRoom.amenities.map((amenityId) => {
                      const amenity = roomAmenities.find(
                        (a) => a.id === amenityId,
                      );
                      if (!amenity) return null;
                      const Icon = getIconComponent(amenity.icon);
                      return (
                        <div
                          key={amenityId}
                          className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg"
                          title={amenity.description}
                        >
                          <Icon size={18} className="text-purple-600" />
                          <span className="text-sm text-gray-700">
                            {amenity.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Room Availability */}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">
                  Tình trạng phòng
                </h4>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-gray-900">
                      {viewingRoom.totalRooms}
                    </p>
                    <p className="text-sm text-gray-500">Tổng số phòng</p>
                  </div>
                  <div className="w-px h-12 bg-gray-300"></div>
                  <div className="flex-1 text-center">
                    <p
                      className={`text-3xl font-bold ${
                        viewingRoom.availableRooms > 0
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {viewingRoom.availableRooms}
                    </p>
                    <p className="text-sm text-gray-500">Phòng trống</p>
                  </div>
                  <div className="w-px h-12 bg-gray-300"></div>
                  <div className="flex-1 text-center">
                    <p className="text-3xl font-bold text-blue-600">
                      {viewingRoom.totalRooms - viewingRoom.availableRooms}
                    </p>
                    <p className="text-sm text-gray-500">Đã đặt</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewingRoom);
                  }}
                  className="flex-1 px-4 py-2.5 bg-[#FF385C] text-white font-medium rounded-lg hover:bg-[#E31C5F] cursor-pointer"
                >
                  Chỉnh sửa
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsManagement;
