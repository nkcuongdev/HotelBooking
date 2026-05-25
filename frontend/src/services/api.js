const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api/v1";

class ApiService {
  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  getToken() {
    return localStorage.getItem("token");
  }

  getHeaders(includeAuth = false) {
    const headers = {
      "Content-Type": "application/json",
    };
    if (includeAuth) {
      const token = this.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return headers;
  }

  async request(endpoint, options = {}) {
    const { auth = false, ...fetchOptions } = options;
    const url = `${this.baseUrl}${endpoint}`;

    const config = {
      ...fetchOptions,
      headers: {
        ...this.getHeaders(auth),
        ...fetchOptions.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      const contentType = response.headers.get("content-type");
      let data;
      
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { error: text || response.statusText };
      }

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }

        throw {
          status: response.status,
          message: data.error || data.message || "Something went wrong",
          data,
        };
      }

      return data;
    } catch (error) {
      if (error.status) throw error;
      console.error("API Request Error:", error);
      throw {
        status: 0,
        message: `Network error or server crash at ${url}. ${error.message || ""}`,
        data: null,
      };
    }
  }

  // ========== AUTH ==========
  async login(email, password) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async register(userData) {
    return this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async getMe() {
    return this.request("/auth/me", { auth: true });
  }

  // ========== HOTELS ==========
  async getHotels(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/hotels?${query}`);
  }

  async getHotel(id) {
    return this.request(`/hotels/${id}`);
  }

  async getHotelRooms(hotelId) {
    return this.request(`/hotels/${hotelId}/rooms`);
  }

  async createHotel(hotelData) {
    return this.request("/hotels", {
      method: "POST",
      body: JSON.stringify(hotelData),
      auth: true,
    });
  }

  async updateHotel(id, hotelData) {
    return this.request(`/hotels/${id}`, {
      method: "PUT",
      body: JSON.stringify(hotelData),
      auth: true,
    });
  }

  async deleteHotel(id) {
    return this.request(`/hotels/${id}`, {
      method: "DELETE",
      auth: true,
    });
  }

  // ========== ROOMS ==========
  async getRooms(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/rooms?${query}`);
  }

  async getRoom(id) {
    return this.request(`/rooms/${id}`);
  }

  async createRoom(roomData) {
    return this.request("/rooms", {
      method: "POST",
      body: JSON.stringify(roomData),
      auth: true,
    });
  }

  async updateRoom(id, roomData) {
    return this.request(`/rooms/${id}`, {
      method: "PUT",
      body: JSON.stringify(roomData),
      auth: true,
    });
  }

  async deleteRoom(id) {
    return this.request(`/rooms/${id}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async checkRoomAvailability(roomId, data) {
    return this.request(`/rooms/check-availability/${roomId}`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // ========== BOOKINGS ==========
  async createBooking(bookingData) {
    return this.request("/bookings", {
      method: "POST",
      body: JSON.stringify(bookingData),
      auth: true,
    });
  }

  async createBookingPayment(id) {
    return this.request(`/bookings/${id}/payments`, {
      method: "POST",
      auth: true,
    });
  }

  async getBookings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/bookings?${query}`, { auth: true });
  }

  async getUserBookings(userId) {
    return this.request(`/bookings/user/${userId}`, { auth: true });
  }

  async getBooking(id) {
    return this.request(`/bookings/${id}`, { auth: true });
  }

  async updateBooking(id, data) {
    return this.request(`/bookings/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: true,
    });
  }

  async confirmBooking(id) {
    return this.request(`/bookings/${id}/confirm`, {
      method: "PATCH",
      auth: true,
    });
  }

  async checkInBooking(id) {
    return this.request(`/bookings/${id}/checkin`, {
      method: "PATCH",
      auth: true,
    });
  }

  async checkOutBooking(id) {
    return this.request(`/bookings/${id}/checkout`, {
      method: "PATCH",
      auth: true,
    });
  }

  async cancelBooking(id) {
    return this.request(`/bookings/${id}`, {
      method: "DELETE",
      auth: true,
    });
  }

  // ========== REVIEWS ==========
  async getHotelReviews(hotelId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reviews/hotel/${hotelId}?${query}`);
  }

  async createReview(reviewData) {
    return this.request("/reviews", {
      method: "POST",
      body: JSON.stringify(reviewData),
      auth: true,
    });
  }

  async updateReview(id, reviewData) {
    return this.request(`/reviews/${id}`, {
      method: "PUT",
      body: JSON.stringify(reviewData),
      auth: true,
    });
  }

  async deleteReview(id) {
    return this.request(`/reviews/${id}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async getUserReviews(userId) {
    return this.request(`/reviews/user/${userId}`, { auth: true });
  }

  async getReviews(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/reviews?${query}`, { auth: true });
  }

  async getEligibleBookingsForReview(hotelId) {
    return this.request(`/reviews/eligible/${hotelId}`, { auth: true });
  }

  // ========== USERS ==========
  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users?${query}`, { auth: true });
  }

  async getUser(id) {
    return this.request(`/users/${id}`, { auth: true });
  }

  async createUser(userData) {
    return this.request("/users", {
      method: "POST",
      body: JSON.stringify(userData),
      auth: true,
    });
  }

  async updateUser(id, userData) {
    return this.request(`/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(userData),
      auth: true,
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: "DELETE",
      auth: true,
    });
  }

  async updateProfile(data) {
    return this.request("/users/profile", {
      method: "PUT",
      body: JSON.stringify(data),
      auth: true,
    });
  }

  async changePassword(data) {
    return this.request("/users/change-password", {
      method: "PUT",
      body: JSON.stringify(data),
      auth: true,
    });
  }

  async getUserStats() {
    return this.request("/users/stats", { auth: true });
  }

  // ========== BLOGS ==========
  async getBlogs(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/blogs${query ? `?${query}` : ""}`, { auth: true });
  }

  async getBlog(identifier) {
    return this.request(`/blogs/${identifier}`);
  }

  async getBlogCategories() {
    return this.request("/blogs/categories");
  }

  async getRelatedBlogs(id) {
    return this.request(`/blogs/${id}/related`);
  }

  async createBlog(blogData) {
    return this.request("/blogs", {
      method: "POST",
      body: JSON.stringify(blogData),
      auth: true,
    });
  }

  async updateBlog(id, blogData) {
    return this.request(`/blogs/${id}`, {
      method: "PUT",
      body: JSON.stringify(blogData),
      auth: true,
    });
  }

  async deleteBlog(id) {
    return this.request(`/blogs/${id}`, {
      method: "DELETE",
      auth: true,
    });
  }

  // ========== AMENITIES ==========
  async getAmenities() {
    return this.request("/amenities");
  }

  async getHotelAmenities() {
    return this.request("/amenities/hotel");
  }

  async getRoomAmenities() {
    return this.request("/amenities/room");
  }

  // ========== CHAT ==========
  async getMyConversation() {
    return this.request("/chat/my-conversation", { auth: true });
  }

  async listConversations() {
    return this.request("/chat/conversations", { auth: true });
  }

  async getConversationMessages(conversationId) {
    return this.request(`/chat/conversations/${conversationId}/messages`, {
      auth: true,
    });
  }

  async sendChatMessage(conversationId, content) {
    return this.request(`/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ content }),
      auth: true,
    });
  }

  async markConversationRead(conversationId) {
    return this.request(`/chat/conversations/${conversationId}/read`, {
      method: "PATCH",
      auth: true,
    });
  }

  // ========== DASHBOARD STATS ==========
  async getDashboardStats() {
    const [hotelsRes, bookingsRes, usersRes] = await Promise.all([
      this.request("/hotels?limit=1", { auth: true }),
      this.request("/bookings?limit=1", { auth: true }),
      this.request("/users/stats", { auth: true }),
    ]);
    return { hotelsRes, bookingsRes, usersRes };
  }
}

const api = new ApiService();
export default api;

