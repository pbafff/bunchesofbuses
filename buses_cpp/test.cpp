#include <iostream>
#include <vector>
#include <array>

int main()
{
  std::vector<long double> numbers = {40.13213231, -74.1321312312, 40.123213123, -74.7567657};
  std::vector<std::array<long double, 2>> coordarrs(numbers.size());
  
  for (int i = 0; i < numbers.size(); i++)
  {
      if (i % 2 == 0)
      {
          std::cout << numbers.size() << "\n";
          coordarrs.push_back({numbers[i], numbers[i + 1]});
      }
  }
  
  coordarrs.shrink_to_fit();
  
  for (auto  &x : coordarrs)
    std::cout << x[0] << x[1] << "\n";
    
  std::cout << coordarrs.size() << "\n" << numbers.size();
  
}

