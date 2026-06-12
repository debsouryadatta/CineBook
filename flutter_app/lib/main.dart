import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import 'core/auth_state.dart';
import 'core/theme.dart';
import 'screens/root_shell.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const CineBookApp());
}

class CineBookApp extends StatelessWidget {
  const CineBookApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthState()..init(),
      child: MaterialApp(
        title: 'CineBook',
        debugShowCheckedModeBanner: false,
        theme: buildAppTheme(),
        home: const RootShell(),
      ),
    );
  }
}
