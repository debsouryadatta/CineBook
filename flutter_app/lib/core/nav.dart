import 'package:flutter/foundation.dart';

/// Selected bottom-navigation tab of the root shell.
/// Lives here so deep screens (e.g. payment success) can switch tabs.
final ValueNotifier<int> rootTabIndex = ValueNotifier<int>(0);

const int homeTab = 0;
const int ticketsTab = 1;
const int chatTab = 2;
const int profileTab = 3;
