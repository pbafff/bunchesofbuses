#include <algorithm>
#include <vector>
#include <filesystem>
#include <iostream>
#include <fstream>
#include <boost/algorithm/string.hpp>
namespace fs = std::filesystem;

int main()
{
std::unordered_map<std::string, std::vector<long double>> polymap = {};

    for (auto &p : fs::directory_iterator("polylines"))
    {
	std::ifstream file;
	auto path = p.path();
        file.open(path.u8string());
        std::string s;
        file >> s;
	std::vector<std::string> strings;
	boost::split(strings, s, boost::is_any_of(","));
	std::vector<long double> numbers;
	numbers.resize(strings.size());
	std::transform(strings.begin(), strings.end(), numbers.begin(), [](std::string x) { return std::stold(x); });
	polymap[path.filename()] = numbers;
    }

std::copy(polymap["B8_0"].begin(), polymap["B8_0"].end(), std::ostream_iterator<long double>(std::cout, " "));
}
