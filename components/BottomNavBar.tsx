import React from 'react';
import { View, StyleSheet, Platform, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { IconButton } from 'react-native-paper';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring } from 'react-native-reanimated';
import { colors } from '../constants/theme';

export const BOTTOM_NAV_HEIGHT = 64;
export const BOTTOM_NAV_PADDING = Platform.OS === 'ios' ? 18 : 10;
export const BOTTOM_NAV_TOTAL_HEIGHT = BOTTOM_NAV_HEIGHT + BOTTOM_NAV_PADDING;

const NAV_ITEMS = [
  { icon: 'home-outline',        label: 'Home',    route: 'dashboard',  color: colors.purple },
  { icon: 'format-list-checks',  label: 'Daily',   route: 'tasks',      color: colors.gold },
  { icon: 'timer-outline',       label: 'Focus',   route: 'focus',      color: colors.green },
  { icon: 'leaf-outline',        label: 'Habits',  route: 'habits',     color: colors.blue },
  { icon: 'trophy-outline',      label: 'Shelf',   route: 'statistics', color: colors.pink },
];

function NavItem({ item, isActive, onPress }: { item: typeof NAV_ITEMS[0]; isActive: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.85, { damping: 10 }, () => {
      scale.value = withSpring(1, { damping: 10 });
    });
    onPress();
  };

  return (
    <TouchableOpacity
      style={styles.navItem}
      activeOpacity={0.8}
      onPress={handlePress}
    >
      <Animated.View style={[styles.iconWrapper, animStyle]}>
        {isActive && (
          <View
            style={[
              styles.activePill,
              { backgroundColor: item.color + '22', borderColor: item.color + '44' },
            ]}
          />
        )}
        <IconButton
          icon={item.icon}
          size={24}
          iconColor={isActive ? item.color : colors.textMuted}
          style={{ zIndex: 2, margin: 0 }}
        />
      </Animated.View>
      {isActive && (
        <View style={[styles.activeDot, { backgroundColor: item.color }]} />
      )}
    </TouchableOpacity>
  );
}

export default function BottomNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const activeIndex = NAV_ITEMS.findIndex(item => pathname.includes(item.route));

  return (
    <View style={styles.outerContainer}>
      <View style={styles.container}>
        {NAV_ITEMS.map((item, idx) => (
          <NavItem
            key={item.route}
            item={item}
            isActive={idx === activeIndex}
            onPress={() => router.push(`/(app)/${item.route}`)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    alignItems: 'center',
    paddingBottom: BOTTOM_NAV_PADDING,
    backgroundColor: 'transparent',
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: BOTTOM_NAV_HEIGHT,
    borderRadius: 32,
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderWidth: 0.5,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: BOTTOM_NAV_HEIGHT,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  activePill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 0.5,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
});
