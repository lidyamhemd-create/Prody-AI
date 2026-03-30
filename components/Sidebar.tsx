import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, IconButton, useTheme } from 'react-native-paper';
import { useAuth } from '../hooks/useAuth';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  interpolate,
  Extrapolate 
} from 'react-native-reanimated';
import UserAvatar from './UserAvatar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SCREEN_WIDTH * 0.8;

interface SidebarProps {
  isVisible: boolean;
  onClose: () => void;
}

export default function Sidebar({ isVisible, onClose }: SidebarProps) {
  const theme = useTheme();
  const { user, session, signOut } = useAuth();
  const router = useRouter();
  
  // Animation values
  const translateX = useSharedValue(-SIDEBAR_WIDTH);
  const overlayOpacity = useSharedValue(0);

  // Get username from user metadata
  const username = user?.user_metadata?.username || session?.user?.user_metadata?.username || user?.email?.split('@')[0] || 'User';
  
  console.log('Sidebar: Current username:', username);
  console.log('Sidebar: User metadata:', user?.user_metadata);
  console.log('Sidebar: Session metadata:', session?.user?.user_metadata);

  React.useEffect(() => {
    if (isVisible) {
      translateX.value = withTiming(0, { duration: 300 });
      overlayOpacity.value = withTiming(1, { duration: 300 });
    } else {
      translateX.value = withTiming(-SIDEBAR_WIDTH, { duration: 300 });
      overlayOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isVisible]);

  const sidebarStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const handleLogout = async () => {
    try {
      await signOut();
      onClose();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleProfile = () => {
    onClose();
    router.push('/(app)/profile');
  };

  const handleSettings = () => {
    onClose();
    router.push('/(app)/offline-settings');
  };

  const handleHome = () => {
    onClose();
    router.push('/(app)/dashboard');
  };

  const menuItems = [
    {
      icon: 'home',
      label: 'Home',
      onPress: handleHome,
      color: '#4CAF50',
    },
    {
      icon: 'account-circle',
      label: 'Profile',
      onPress: handleProfile,
      color: '#7B61FF',
    },
    {
      icon: 'cog',
      label: 'Settings',
      onPress: handleSettings,
      color: '#FF9800',
    },
    {
      icon: 'logout',
      label: 'Logout',
      onPress: handleLogout,
      color: '#F44336',
    },
  ];

  return (
    <>
      {/* Overlay */}
      <Animated.View 
        style={[styles.overlay, overlayStyle]} 
        pointerEvents={isVisible ? 'auto' : 'none'}
      >
        <TouchableOpacity 
          style={styles.overlayTouchable} 
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Sidebar */}
      <Animated.View style={[styles.sidebar, sidebarStyle]}>
        {/* Header */}
        <View style={styles.header}>
          <UserAvatar
            size={80}
            style={styles.avatar}
            showBorder={true}
            borderColor="#7B61FF"
          />
          <Text style={styles.userName}>
            {username}
          </Text>
          <Text style={styles.userEmail}>
            {user?.email}
          </Text>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color }]}>
                <IconButton
                  icon={item.icon}
                  size={24}
                  iconColor="#fff"
                  style={styles.iconButton}
                />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.version}>ProdyAI v1.0</Text>
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  overlayTouchable: {
    flex: 1,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SIDEBAR_WIDTH,
    height: '100%',
    backgroundColor: '#fff',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 2, height: 0 },
    elevation: 8,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  avatar: {
    marginBottom: 16,
    backgroundColor: '#f0f0f0',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#888',
  },
  menuContainer: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  menuIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconButton: {
    margin: 0,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  version: {
    fontSize: 12,
    color: '#888',
  },
}); 