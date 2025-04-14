import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { auth } from './firebaseConfig';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Importaciones absolutas desde la carpeta screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import PagosScreen from './screens/PagosScreen';
import EquipamientoScreen from './screens/EquipamientoScreen';
import AvisosScreen from './screens/AvisosScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Perfil') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Avisos') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#b51f28',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: { backgroundColor: '#fff' },
      })}
    >
      <Tab.Screen name="Perfil" component={ProfileScreen} />
      <Tab.Screen name="Avisos" component={AvisosScreen} />
    </Tab.Navigator>
  );
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setIsLoggedIn(true);
      } else {
        setIsLoggedIn(false);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={isLoggedIn ? 'MainTabs' : 'Login'}>
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="MainTabs"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="HomeScreen"
            component={HomeScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="Pagos"
            component={PagosScreen}
            options={({ navigation }) => ({
              headerLeft: () => (
                <TouchableOpacity 
                  onPress={() => navigation.goBack()}
                  style={{ marginLeft: 15 }}
                >
                  <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
              ),
              title: 'Pagos del Jugador',
              headerTitleAlign: 'center',
            })}
          />
          <Stack.Screen
            name="Equipamiento"
            component={EquipamientoScreen}
            options={({ navigation }) => ({
              headerLeft: () => (
                <TouchableOpacity 
                  onPress={() => navigation.goBack()}
                  style={{ marginLeft: 15 }}
                >
                  <Ionicons name="arrow-back" size={24} color="#000" />
                </TouchableOpacity>
              ),
              title: 'Equipamiento',
              headerTitleAlign: 'center',
            })}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;