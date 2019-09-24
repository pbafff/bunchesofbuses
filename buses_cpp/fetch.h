#include <nlohmann/json.hpp>

using json = nlohmann::json;

json fetch(std::string host, std::string port, std::string target);
