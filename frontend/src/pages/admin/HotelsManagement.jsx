import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Star,
  MapPin,
  X,
  Link,
  DoorOpen,
  Users,
  BedDouble,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { hotelAmenities, getIconComponent } from "../../data/amenities";
import api from "../../services/api";
import { formatVnd } from "../../utils/currency";

const HotelsManagement = () => {
  const navigate = useNavigate();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingHotel, setViewingHotel] = useState(null);
  const [viewingHotelRooms, setViewingHotelRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [editingHotel, setEditingHotel] = useState(null);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    city: "",
    address: "",
    status: "active",
    description: "",
  });
  const [selectedAmenities, setSelectedAmenities] = useState([]);
  const [imagePreview, setImagePreview] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [newImageUrl, setNewImageUrl] = useState("");

  const itemsPerPage = 5;

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    setLoading(true);
    try {
      const res = await api.getHotels({ limit: 100 });
      const data = res.data || res.hotels || res || [];
      setHotels(
        (Array.isArray(data) ? data : []).map((h) => ({
          ...h,
          id: h._id || h.id,
          image: h.images?.[0] || h.image || "",
          status: h.status || "active",
          amenities: h.amenities || [],
        })),
      );
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleView = async (hotel) => {
    setViewingHotel(hotel);
    setViewingHotelRooms([]);
    setShowViewModal(true);
    setActiveDropdown(null);
    setLoadingRooms(true);
    try {
      const res = await api.getHotelRooms(hotel.id || hotel._id);
      const rooms = res.data || res.rooms || res || [];
      setViewingHotelRooms(Array.isArray(rooms) ? rooms : []);
    } catch {
      setViewingHotelRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const cities = [
    ...new Set(hotels.map((hotel) => hotel.city).filter(Boolean)),
  ];

  const filteredHotels = hotels.filter((hotel) => {
    const matchesSearch =
      hotel.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      hotel.city?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter ? hotel.status === statusFilter : true;
    const matchesCity = cityFilter ? hotel.city === cityFilter : true;
    return matchesSearch && matchesStatus && matchesCity;
  });

  const hasActiveFilters = statusFilter || cityFilter;

  const clearAllFilters = () => {
    setStatusFilter("");
    setCityFilter("");
    setSearchTerm("");
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(filteredHotels.length / itemsPerPage);
  const paginatedHotels = filteredHotels.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const handleEdit = (hotel) => {
    setEditingHotel(hotel);
    setFormData({
      name: hotel.name || "",
      city: hotel.city || "",
      address: hotel.address || "",
      status: hotel.status || "active",
      description: hotel.description || "",
    });
    setSelectedAmenities(hotel.amenities || []);
    setImageUrls(hotel.images || (hotel.image ? [hotel.image] : []));
    setImagePreview(hotel.images || (hotel.image ? [hotel.image] : []));
    setNewImageUrl("");
    setShowModal(true);
    setActiveDropdown(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bạn có chắc muốn xóa khách sạn này?")) return;
    setActiveDropdown(null);
    try {
      await api.deleteHotel(id);
      setHotels((prev) => prev.filter((h) => h.id !== id));
    } catch (err) {
      alert(err.message || "Xóa thất bại");
    }
  };

  const handleAddNew = () => {
    setEditingHotel(null);
    setFormData({
      name: "",
      city: "",
      address: "",
      status: "active",
      description: "",
    });
    setSelectedAmenities([]);
    setImageUrls([]);
    setImagePreview([]);
    setNewImageUrl("");
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
    setImageUrls((prev) => [...prev, url]);
    setNewImageUrl("");
  };

  const handleRemoveImage = (index) => {
    setImagePreview((prev) => prev.filter((_, i) => i !== index));
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...formData,
        amenities: selectedAmenities,
        images: imageUrls.length > 0 ? imageUrls : undefined,
      };

      if (editingHotel) {
        const res = await api.updateHotel(editingHotel.id, payload);
        const updated = res.data || res;
        setHotels((prev) =>
          prev.map((h) =>
            h.id === editingHotel.id
              ? {
                  ...h,
                  ...updated,
                  id: updated._id || updated.id || editingHotel.id,
                  image:
                    updated.images?.[0] ||
                    updated.image ||
                    imageUrls[0] ||
                    h.image,
                }
              : h,
          ),
        );
      } else {
        const res = await api.createHotel(payload);
        const created = res.data || res;
        setHotels((prev) => [
          ...prev,
          {
            ...created,
            id: created._id || created.id,
            image: created.images?.[0] || created.image || imageUrls[0] || "",
            status: created.status || "active",
            amenities: created.amenities || selectedAmenities,
          },
        ]);
      }
      setShowModal(false);
    } catch (err) {
      alert(err.message || "Lưu thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleManageRooms = (hotelName) => {
    navigate("/admin/rooms", { state: { filterHotel: hotelName } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Quản lý khách sạn
          </h1>
          <p className="text-gray-500 mt-1">
            Quản lý danh sách khách sạn của bạn
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#FF385C] text-white font-medium rounded-lg hover:bg-[#E31C5F] transition-colors cursor-pointer"
        >
          <Plus size={20} />
          Thêm khách sạn
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Tìm kiếm khách sạn..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] cursor-pointer"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Hoạt động</option>
          <option value="inactive">Ngừng hoạt động</option>
        </select>
        <select
          value={cityFilter}
          onChange={(e) => {
            setCityFilter(e.target.value);
            setCurrentPage(1);
          }}
          className="px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] cursor-pointer"
        >
          <option value="">Tất cả thành phố</option>
          {cities.map((city) => (
            <option key={city} value={city}>
              {city}
            </option>
          ))}
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

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={32} className="animate-spin text-[#FF385C]" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 font-medium">Khách sạn</th>
                  <th className="px-6 py-4 font-medium hidden md:table-cell">
                    Địa điểm
                  </th>
                  <th className="px-6 py-4 font-medium hidden lg:table-cell">
                    Đánh giá
                  </th>
                  <th className="px-6 py-4 font-medium">Trạng thái</th>
                  <th className="px-6 py-4 font-medium text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHotels.map((hotel) => (
                  <tr
                    key={hotel.id}
                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {hotel.image ? (
                          <img
                            src={hotel.image}
                            alt={hotel.name}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-200" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">
                            {hotel.name}
                          </p>
                          <p className="text-sm text-gray-500 md:hidden">
                            {hotel.city}
                          </p>
                          {hotel.amenities && hotel.amenities.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              {hotel.amenities.slice(0, 4).map((amenityId) => {
                                const amenity = hotelAmenities.find(
                                  (a) => a.id === amenityId,
                                );
                                if (!amenity) return null;
                                const Icon = getIconComponent(amenity.icon);
                                return (
                                  <span
                                    key={amenityId}
                                    title={amenity.name}
                                    className="p-1 bg-gray-100 rounded text-gray-500"
                                  >
                                    <Icon size={12} />
                                  </span>
                                );
                              })}
                              {hotel.amenities.length > 4 && (
                                <span className="text-xs text-gray-400">
                                  +{hotel.amenities.length - 4}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-gray-600">
                        <MapPin size={14} />
                        <span className="text-sm">{hotel.city}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {hotel.address}
                      </p>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-1">
                        <Star
                          size={14}
                          className="text-amber-400 fill-amber-400"
                        />
                        <span className="font-medium text-gray-900">
                          {hotel.rating || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                          hotel.status === "active"
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {hotel.status === "active" ? "Hoạt động" : "Ngừng"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end relative">
                        <button
                          onClick={() =>
                            setActiveDropdown(
                              activeDropdown === hotel.id ? null : hotel.id,
                            )
                          }
                          className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
                        >
                          <MoreVertical size={18} className="text-gray-500" />
                        </button>
                        {activeDropdown === hotel.id && (
                          <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10">
                            <button
                              onClick={() => handleView(hotel)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                              <Eye size={16} /> Xem chi tiết
                            </button>
                            <button
                              onClick={() => handleEdit(hotel)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer"
                            >
                              <Edit size={16} /> Chỉnh sửa
                            </button>
                            <button
                              onClick={() => {
                                setActiveDropdown(null);
                                handleManageRooms(hotel.name);
                              }}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-blue-600 hover:bg-gray-50 cursor-pointer"
                            >
                              <DoorOpen size={16} /> Quản lý phòng
                            </button>
                            <button
                              onClick={() => handleDelete(hotel.id)}
                              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-50 cursor-pointer"
                            >
                              <Trash2 size={16} /> Xóa
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedHotels.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-500"
                    >
                      Không có khách sạn nào
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
          <p className="text-sm text-gray-500">
            Hiển thị {paginatedHotels.length} / {filteredHotels.length} khách
            sạn
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Trước
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 text-sm rounded-lg cursor-pointer ${currentPage === page ? "bg-[#FF385C] text-white" : "border border-gray-200 hover:bg-gray-50"}`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              Sau
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingHotel ? "Sửa khách sạn" : "Thêm khách sạn mới"}
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
                  Tên khách sạn
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                  placeholder="Nhập tên khách sạn"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thành phố
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleFormChange}
                    required
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                    placeholder="Thành phố"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trạng thái
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleFormChange}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Ngừng hoạt động</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleFormChange}
                  required
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C]"
                  placeholder="Địa chỉ đầy đủ"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleFormChange}
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-[#FF385C]/20 focus:border-[#FF385C] resize-none"
                  placeholder="Mô tả về khách sạn"
                />
              </div>

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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tiện nghi khách sạn
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto p-1">
                  {hotelAmenities.map((amenity) => {
                    const Icon = getIconComponent(amenity.icon);
                    const isSelected = selectedAmenities.includes(amenity.id);
                    return (
                      <button
                        key={amenity.id}
                        type="button"
                        onClick={() => toggleAmenity(amenity.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${isSelected ? "border-[#FF385C] bg-[#FF385C]/10 text-[#FF385C]" : "border-gray-200 hover:border-gray-300 text-gray-600"}`}
                      >
                        <Icon size={18} />
                        <span className="text-sm">{amenity.name}</span>
                      </button>
                    );
                  })}
                </div>
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
                  {editingHotel ? "Lưu thay đổi" : "Thêm khách sạn"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && viewingHotel && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Chi tiết khách sạn
              </h2>
              <button
                onClick={() => setShowViewModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {(
                viewingHotel.images ||
                (viewingHotel.image ? [viewingHotel.image] : [])
              ).length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  {(viewingHotel.images || [viewingHotel.image]).map(
                    (img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt={`${viewingHotel.name} ${index + 1}`}
                        className={`rounded-lg object-cover ${index === 0 ? "col-span-2 row-span-2 h-64" : "h-[7.5rem]"}`}
                      />
                    ),
                  )}
                </div>
              )}
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-2xl font-bold text-gray-900">
                    {viewingHotel.name}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${viewingHotel.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {viewingHotel.status === "active"
                      ? "Hoạt động"
                      : "Ngừng hoạt động"}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-gray-600 mb-4">
                  <MapPin size={16} />
                  <span>
                    {viewingHotel.address}, {viewingHotel.city}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <Star size={18} className="text-amber-400 fill-amber-400" />
                    <span className="font-semibold">
                      {viewingHotel.rating || 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 rounded-full">
                    <DoorOpen size={16} className="text-blue-600" />
                    {loadingRooms ? (
                      <span className="text-sm text-blue-600">Đang tải...</span>
                    ) : (
                      <span className="text-sm font-semibold text-blue-700">
                        {viewingHotelRooms.length} phòng hiện có
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {viewingHotel.description && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-2">Mô tả</h4>
                  <p className="text-gray-600">{viewingHotel.description}</p>
                </div>
              )}
              {viewingHotel.amenities && viewingHotel.amenities.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">
                    Tiện nghi khách sạn
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {viewingHotel.amenities.map((amenityId) => {
                      const amenity = hotelAmenities.find(
                        (a) => a.id === amenityId,
                      );
                      if (!amenity) return null;
                      const Icon = getIconComponent(amenity.icon);
                      return (
                        <div
                          key={amenityId}
                          className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg"
                        >
                          <Icon size={18} className="text-blue-600" />
                          <span className="text-sm text-gray-700">
                            {amenity.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <DoorOpen size={18} className="text-blue-600" />
                  Danh sách phòng
                  {!loadingRooms && (
                    <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      {viewingHotelRooms.length}
                    </span>
                  )}
                </h4>
                {loadingRooms ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 size={24} className="animate-spin text-[#FF385C]" />
                  </div>
                ) : viewingHotelRooms.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-3">Chưa có phòng nào</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {viewingHotelRooms.map((room) => (
                      <div
                        key={room._id || room.id}
                        className="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          <BedDouble size={16} className="text-gray-400" />
                          <span className="text-sm font-medium text-gray-800">
                            {room.title || room.name || "Phòng"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {room.maxPeople && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Users size={12} />
                              {room.maxPeople} khách
                            </span>
                          )}
                          {room.price && (
                            <span className="text-xs font-semibold text-[#FF385C]">
                              {formatVnd(room.price)}/đêm
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              room.availableRooms > 0
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {room.availableRooms ?? 0}/{room.totalRooms ?? 0} phòng trống
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleEdit(viewingHotel);
                  }}
                  className="flex-1 px-4 py-2.5 bg-[#FF385C] text-white font-medium rounded-lg hover:bg-[#E31C5F] cursor-pointer"
                >
                  Chỉnh sửa
                </button>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleManageRooms(viewingHotel.name);
                  }}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer flex items-center justify-center gap-2"
                >
                  <DoorOpen size={16} />
                  Quản lý phòng
                </button>
                <button
                  onClick={() => setShowViewModal(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 cursor-pointer"
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

export default HotelsManagement;
