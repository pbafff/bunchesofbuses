#include <vector>
#include <nlohmann/json.hpp>
#include <pqxx/pqxx>
#include "sharedqueue.h"

using json = nlohmann::json;
using json_vec_vec = std::vector<std::vector<json>>;

void track(std::string route, std::string boro, SharedQueue<std::string> &queue);
void db_connection(SharedQueue<std::string> &queue);
