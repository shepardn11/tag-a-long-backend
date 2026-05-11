// TypeScript Types for Tag-A-Long App

export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string;
  city: string;
  bio?: string;
  profile_photo_url?: string;
  photo_gallery?: string[];
  instagram_handle?: string;
  created_at: string;
  is_premium?: boolean;
}

export interface ActivityListing {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  category: string;
  location: string;
  date: string;
  time?: string;
  max_participants?: number;
  tagged_users?: User[]; // Users tagged as joining this activity
  photo_url?: string; // Primary listing photo
  photos?: string[];  // Additional photos gallery
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;

  // From JOIN with profiles
  username?: string;
  display_name?: string;
  profile_photo_url?: string;
  is_premium?: boolean;
}

export interface TagAlongRequest {
  id: string;
  listing_id: string;
  sender_id: string;
  receiver_id: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at?: string;

  // From JOINs
  sender?: User;
  receiver?: User;
  listing?: ActivityListing;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data?: any;
  read: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  participants: string[];
  last_message?: Message;
  updated_at: string;
}

// Auth types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  display_name: string;
  username: string;
  city: string;
  date_of_birth: string;
  bio?: string;
  instagram_handle?: string;
  phone: string;
  otp_code: string;
}

export type SignupFormData = Omit<SignupData, 'otp_code'>;

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  PhoneVerification: { signupData: SignupFormData };
  ProfileSetup: undefined;
  ForgotPassword: undefined;
  ResetPassword: { email: string };
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Messages: undefined;
  MyActivities: undefined;
  Profile: undefined;
};

export type HomeStackParamList = {
  Feed: undefined;
  ActivityDetail: { activityId: string };
  CreateActivity: undefined;
  UserProfile: { userId: string };
  Notifications: undefined;
};

export type SearchStackParamList = {
  SearchMain: undefined;
  UserProfile: { user: User };
  ActivityDetail: { activityId: string };
};

export type MessagesStackParamList = {
  MessagesList: undefined;
  Chat: {
    conversationId: string;
    otherUser: {
      id: string;
      username: string;
      display_name: string;
      profile_photo_url?: string;
    };
  };
};

export type ActivitiesStackParamList = {
  MyActivitiesMain: undefined;
  ActivityDetail: { activityId: string };
  CreateActivity: undefined;
  UserProfile: { userId: string };
};

export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Subscription: undefined;
};
