import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "@/screens/Login";
import CadastroScreen from "@/screens/Cadastro";

export type AuthStackParamList = {
  Login: undefined;
  Cadastro: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Cadastro" component={CadastroScreen} />
    </Stack.Navigator>
  );
}
